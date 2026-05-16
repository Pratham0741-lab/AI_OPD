"""
Twilio Phone Call Integration for Voice Assistant (GPU-Free)

Handles the complete lifecycle of automated medication adherence phone calls:
1. Initiate outbound call via Twilio REST API
2. Play health-check question via Sarvam AI TTS (Bulbul v3)
3. Record patient's spoken answer via TwiML <Record>
4. Transcribe recording via Deepgram Nova-3 STT
5. Classify intent using keyword matching (CPU only)
6. Generate multilingual TTS confirmation via Sarvam AI
7. Play confirmation to patient and hang up
8. Log everything to the database
"""

import os
import re
import uuid
import time
import base64
import random
import logging
import datetime

import httpx

from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from fastapi.responses import Response, FileResponse, JSONResponse
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.twilio_config import (
    get_twilio_config, is_twilio_configured, validate_twilio_connection,
    check_webhook_reachable, check_ngrok_local,
    get_sarvam_config, is_sarvam_configured,
    get_deepgram_config, is_deepgram_configured,
)
from backend.constants import (
    HEALTH_QUESTIONS, RESPONSE_YES, RESPONSE_NO,
    RESPONSE_UNCLEAR, SARVAM_LANG_MAP, DEEPGRAM_LANG_MAP, LANG_NAMES,
    SUPPORTED_LANG_CODES, TWILIO_SPEECH_LANG, TWILIO_SAY_VOICE,
    SHORT_RESPONSE_YES, SHORT_RESPONSE_NO, SHORT_RESPONSE_UNCLEAR,
    GREETING_TEXT, ANSWER_PROMPT_TEXT, HEALTH_QUESTIONS_ML,
)
from backend.intent import classify_call_response
import backend.models as models

logger = logging.getLogger("twilio-calls")

router = APIRouter()

# ──────────────────────────────────────────────────────────────
# Temp Audio Directory (for serving TTS files to Twilio)
# ──────────────────────────────────────────────────────────────
# Must match generate_tts_file() — single directory for all TTS MP3s
TEMP_AUDIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_audio")
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)


def _audio_filepath(filename: str) -> str:
    """Resolve TTS filename safely (no path traversal)."""
    safe_name = os.path.basename(filename)
    return os.path.join(TEMP_AUDIO_DIR, safe_name)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



# ──────────────────────────────────────────────────────────────
# Sarvam AI TTS — replaces gTTS for natural Indian-language voices
# Deepgram Nova-3 STT — replaces Twilio's built-in <Gather speech>
# ──────────────────────────────────────────────────────────────

SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"
DEEPGRAM_LISTEN_URL = "https://api.deepgram.com/v1/listen"


def generate_tts_file(text: str, lang: str, filename: str) -> str:
    """
    Generate a TTS MP3 file using Sarvam AI REST API.
    Falls back to English if the requested language fails.
    Returns the file path.
    """
    sarvam = get_sarvam_config()
    filepath = os.path.join(TEMP_AUDIO_DIR, filename)

    sarvam_lang = SARVAM_LANG_MAP.get(lang, "en-IN")

    def _call_sarvam(target_lang: str) -> bytes:
        payload = {
            "text": text,
            "target_language_code": target_lang,
            "speaker": sarvam["speaker"] if sarvam else "simran",
            "model": sarvam["model"] if sarvam else "bulbul:v3",
            "output_audio_codec": "mp3",
            "enable_preprocessing": True,
        }
        headers = {
            "api-subscription-key": sarvam["api_key"] if sarvam else "",
            "Content-Type": "application/json",
        }
        resp = httpx.post(SARVAM_TTS_URL, json=payload, headers=headers, timeout=30.0)
        resp.raise_for_status()
        data = resp.json()
        # Sarvam returns base64-encoded audio in the "audios" field
        audio_b64 = data.get("audios", [None])[0]
        if not audio_b64:
            raise ValueError("No audio data in Sarvam response")
        return base64.b64decode(audio_b64)

    try:
        audio_bytes = _call_sarvam(sarvam_lang)
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
        logger.info(f"🔊 Sarvam TTS: '{text[:50]}...' → {filename} ({sarvam_lang})")
        return filepath
    except Exception as e:
        logger.error(f"🔊 Sarvam TTS failed for lang '{sarvam_lang}': {e}")
        # Fallback to English
        try:
            audio_bytes = _call_sarvam("en-IN")
            with open(filepath, "wb") as f:
                f.write(audio_bytes)
            return filepath
        except Exception as e2:
            logger.error(f"🔊 Sarvam TTS fallback also failed: {e2}")
            raise


def _parse_deepgram_response(data: dict, fallback_lang: str) -> dict:
    """Parse Deepgram JSON into transcript, confidence, detected_language."""
    transcript = ""
    confidence = 0.0
    detected_lang = fallback_lang
    try:
        channel = data["results"]["channels"][0]
        alt = channel["alternatives"][0]
        transcript = alt.get("transcript", "").strip()
        confidence = alt.get("confidence", 0.0)
        dg_detected = channel.get("detected_language") or alt.get("detected_language", "")
        if dg_detected:
            dg_to_internal = {
                "en": "en", "en-IN": "en", "en-US": "en",
                "hi": "hi", "hi-IN": "hi", "kn": "kn", "kn-IN": "kn",
                "mr": "mr", "ta": "ta", "te": "te", "bn": "bn",
                "ml": "ml", "gu": "gu", "pa": "pa", "or": "or",
            }
            detected_lang = dg_to_internal.get(dg_detected.split("-")[0], dg_to_internal.get(dg_detected, fallback_lang))
    except (KeyError, IndexError):
        pass
    return {"transcript": transcript, "confidence": confidence, "detected_language": detected_lang}


def transcribe_with_deepgram(audio_url: str, lang: str = "hi") -> dict:
    """
    Transcribe patient audio with Deepgram Nova-3.
    Always uses multilingual mode first; retries with Hindi/Kannada hints if empty.
    The UI-selected call language does NOT restrict STT — answers may be in any language.
    """
    dg_config = get_deepgram_config()
    if not dg_config:
        raise ValueError("Deepgram API key not configured")

    twilio_config = get_twilio_config()
    twilio_auth = None
    if twilio_config:
        twilio_auth = (twilio_config["account_sid"], twilio_config["auth_token"])

    dl_resp = httpx.get(audio_url, auth=twilio_auth, timeout=30.0, follow_redirects=True)
    dl_resp.raise_for_status()
    audio_bytes = dl_resp.content
    logger.info(f"🎙️ Downloaded Twilio recording: {len(audio_bytes)} bytes")

    headers = {
        "Authorization": f"Token {dg_config['api_key']}",
        "Content-Type": "audio/wav",
    }

    # Single multilingual pass — fast path for short yes/no answers
    params = {
        "model": "nova-3",
        "language": "multi",
        "smart_format": "true",
        "punctuate": "true",
    }
    resp = httpx.post(
        DEEPGRAM_LISTEN_URL,
        content=audio_bytes,
        headers=headers,
        params=params,
        timeout=12.0,
    )
    resp.raise_for_status()
    parsed = _parse_deepgram_response(resp.json(), lang)
    logger.info(
        f"🎙️ Deepgram: '{parsed['transcript']}' "
        f"(confidence={parsed['confidence']:.2f}, detected={parsed['detected_language']})"
    )
    return parsed


def normalize_phone_e164(phone: str, default_country_code: str = "91") -> str:
    """Normalize to E.164 (+919876543210). Twilio requires this format."""
    raw = phone.strip()
    if raw.startswith("+"):
        digits = re.sub(r"\D", "", raw)
        return f"+{digits}" if digits else raw
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return raw
    if len(digits) == 10:
        return f"+{default_country_code}{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"+{default_country_code}{digits[1:]}"
    if len(digits) >= 11 and not raw.startswith("+"):
        return f"+{digits}"
    return f"+{digits}"


def create_outbound_call(config: dict, to: str, call_log_id: int, language: str) -> str:
    """
    Place outbound call via Twilio REST API (httpx with explicit timeout).
    Returns call SID.
    """
    base_url = config["webhook_base_url"]
    voice_url = f"{base_url}/api/twilio/voice-webhook?call_log_id={call_log_id}&lang={language}"
    status_url = f"{base_url}/api/twilio/status-callback?call_log_id={call_log_id}"

    api_url = f"https://api.twilio.com/2010-04-01/Accounts/{config['account_sid']}/Calls.json"
    payload = {
        "To": to,
        "From": config["phone_number"],
        "Url": voice_url,
        "StatusCallback": status_url,
        "StatusCallbackEvent": ["initiated", "ringing", "answered", "completed"],
        "Timeout": "30",
    }

    resp = httpx.post(
        api_url,
        data=payload,
        auth=(config["account_sid"], config["auth_token"]),
        timeout=30.0,
    )
    if resp.status_code >= 400:
        try:
            err = resp.json()
            msg = err.get("message") or err.get("detail") or resp.text
            code = err.get("code", resp.status_code)
        except Exception:
            msg = resp.text
            code = resp.status_code
        raise ValueError(f"Twilio error {code}: {msg}")

    data = resp.json()
    return data["sid"]


def pregenerate_opening_audio(call_id: int, language: str, question_text: str):
    """Greeting, question, prompt only — must finish before dialing."""
    greeting_text = GREETING_TEXT.get(language, GREETING_TEXT["en"])
    prompt_text = ANSWER_PROMPT_TEXT.get(language, ANSWER_PROMPT_TEXT["en"])
    generate_tts_file(greeting_text, language, f"greeting_{call_id}.mp3")
    generate_tts_file(question_text, language, f"question_{call_id}.mp3")
    generate_tts_file(prompt_text, language, f"prompt_{call_id}.mp3")


def pregenerate_confirmation_audio(call_id: int, languages: list[str]):
    """Pre-generate yes/no/unclear MP3s for priority languages (runs in background)."""
    for resp_lang in languages:
        if resp_lang not in SUPPORTED_LANG_CODES:
            continue
        for intent_type, responses in [("yes", RESPONSE_YES), ("no", RESPONSE_NO)]:
            resp_text = responses.get(resp_lang, responses["en"])[0]
            fname = f"conf_{intent_type}_{resp_lang}_{call_id}.mp3"
            if not os.path.exists(_audio_filepath(fname)):
                try:
                    generate_tts_file(resp_text, resp_lang, fname)
                except Exception as e:
                    logger.warning(f"📞 TTS skip {fname}: {e}")
        unclear_text = RESPONSE_UNCLEAR.get(resp_lang, RESPONSE_UNCLEAR["en"])
        fname = f"conf_unclear_{resp_lang}_{call_id}.mp3"
        if not os.path.exists(_audio_filepath(fname)):
            try:
                generate_tts_file(unclear_text, resp_lang, fname)
            except Exception as e:
                logger.warning(f"📞 TTS skip {fname}: {e}")
    logger.info(f"📞 Confirmation TTS ready for call {call_id}: {languages}")


def _resolve_confirmation_file(call_id: int, intent: str, lang: str) -> str | None:
    """Find first available pre-generated confirmation MP3 (with language fallbacks)."""
    intent_key = {"Yes": "yes", "No": "no"}.get(intent, "unclear")
    fallbacks = list(dict.fromkeys([lang, "en", "hi", "kn"]))
    for lc in fallbacks:
        fname = f"conf_{intent_key}_{lc}_{call_id}.mp3"
        if os.path.exists(_audio_filepath(fname)):
            return fname
    return None


def _short_confirmation_text(intent: str, lang: str) -> str:
    """Short text for instant Twilio <Say> when MP3 is not ready."""
    lc = lang if lang in SUPPORTED_LANG_CODES else "en"
    if intent == "Yes":
        return SHORT_RESPONSE_YES.get(lc, SHORT_RESPONSE_YES["en"])
    if intent == "No":
        return SHORT_RESPONSE_NO.get(lc, SHORT_RESPONSE_NO["en"])
    return SHORT_RESPONSE_UNCLEAR.get(lc, SHORT_RESPONSE_UNCLEAR["en"])


def _save_interview_response(call_log_id: int, speech_result: str, detected_lang: str, intent: str, confirmation: str):
    """Persist call result to DB (runs after TwiML is returned to Twilio)."""
    db = SessionLocal()
    try:
        call_log = db.query(models.TwilioCallLog).filter(models.TwilioCallLog.id == call_log_id).first()
        if not call_log or not call_log.patient_id:
            return
        today = datetime.datetime.utcnow().date()
        existing_session = db.query(models.InterviewSession).filter(
            models.InterviewSession.patient_id == call_log.patient_id,
            models.InterviewSession.start_time >= datetime.datetime(today.year, today.month, today.day),
        ).first()
        if existing_session:
            db_session_id = existing_session.id
        else:
            new_session = models.InterviewSession(patient_id=call_log.patient_id)
            db.add(new_session)
            db.commit()
            db.refresh(new_session)
            db_session_id = new_session.id
        db.add(models.InterviewResponse(
            session_id=db_session_id,
            assistant_question=call_log.question_text,
            patient_transcript=speech_result,
            detected_language=detected_lang,
            intent=intent,
            call_type="twilio",
            ai_response_text=confirmation,
        ))
        db.commit()
    except Exception as e:
        logger.error(f"📞 Failed to save InterviewResponse: {e}")
    finally:
        db.close()


def cleanup_old_audio_files():
    """Delete temp audio files older than 1 hour."""
    if not os.path.exists(TEMP_AUDIO_DIR):
        return
    cutoff = time.time() - 3600
    for filename in os.listdir(TEMP_AUDIO_DIR):
        filepath = os.path.join(TEMP_AUDIO_DIR, filename)
        if os.path.isfile(filepath) and os.path.getmtime(filepath) < cutoff:
            try:
                os.remove(filepath)
            except:
                pass


# ──────────────────────────────────────────────────────────────
# Twilio API Endpoints
# ──────────────────────────────────────────────────────────────

@router.get("/config")
async def twilio_config_status():
    """Check if Twilio is configured and test the connection (fast, parallel checks)."""
    if not is_twilio_configured():
        return JSONResponse(content={
            "configured": False,
            "message": "Twilio credentials not found. Create a .env file with TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and TWILIO_WEBHOOK_BASE_URL."
        })

    from concurrent.futures import ThreadPoolExecutor

    config = get_twilio_config()

    with ThreadPoolExecutor(max_workers=2) as pool:
        twilio_future = pool.submit(validate_twilio_connection, 8.0)
        webhook_future = pool.submit(check_ngrok_local, 2.0)
        success, message = twilio_future.result(timeout=10.0)
        webhook_ok, webhook_msg = webhook_future.result(timeout=10.0)

    return JSONResponse(content={
        "configured": True,
        "connected": success,
        "message": message,
        "webhook_base_url": config["webhook_base_url"],
        "webhook_reachable": webhook_ok,
        "webhook_message": webhook_msg,
        "sarvam_configured": is_sarvam_configured(),
        "deepgram_configured": is_deepgram_configured(),
    })


@router.get("/serve-audio/{filename}")
async def serve_audio(filename: str):
    """Serve a generated TTS audio file to Twilio's <Play> verb."""
    filepath = _audio_filepath(filename)
    if not os.path.exists(filepath):
        logger.warning(f"📞 Audio not found: {filename}")
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(filepath, media_type="audio/mpeg")


@router.post("/initiate-call")
async def initiate_call(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Initiate an outbound phone call to a patient for medication adherence check.
    Question is asked in the PATIENT'S SELECTED LANGUAGE using gTTS.
    Patient responds in their language. System responds back in that language.
    NO GPU required.
    """
    config = get_twilio_config()
    if not config:
        raise HTTPException(status_code=400, detail="Twilio not configured. Set credentials in .env file.")

    data = await request.json()
    phone_number = data.get("phone_number", "").strip()
    patient_id = data.get("patient_id")
    patient_name = data.get("patient_name", "Patient")
    question_id = data.get("question_id", 0)
    language = data.get("language", "en")  # patient's preferred language

    if language not in SUPPORTED_LANG_CODES:
        language = "en"

    if not phone_number:
        raise HTTPException(status_code=400, detail="Phone number is required.")

    phone_number = normalize_phone_e164(phone_number)
    if not re.match(r"^\+\d{10,15}$", phone_number):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid phone number '{phone_number}'. Use E.164 format, e.g. +919876543210",
        )

    webhook_ok, webhook_msg = check_ngrok_local(timeout=3.0)
    if not webhook_ok:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot place call — Twilio cannot reach your server. {webhook_msg} "
                "Run in a terminal: ngrok http 8000, then set TWILIO_WEBHOOK_BASE_URL in .env to the ngrok HTTPS URL."
            ),
        )

    # Get question text in patient's language
    q_map = HEALTH_QUESTIONS_ML.get(question_id % len(HEALTH_QUESTIONS_ML), HEALTH_QUESTIONS_ML[0])
    question_text = q_map.get(language, q_map["en"])
    question_text_en = q_map["en"]  # Keep English for logging/display

    # Create call log entry
    patient_id_int = int(patient_id) if patient_id and str(patient_id).isdigit() else None
    call_log = models.TwilioCallLog(
        patient_id=patient_id_int,
        phone_number=phone_number,
        question_text=question_text_en,
        detected_language=language,
        status="initiating",
    )
    db.add(call_log)
    db.commit()
    db.refresh(call_log)

    call_id = call_log.id

    # Only generate call-opening audio before dialing (avoids Twilio API timeout)
    try:
        pregenerate_opening_audio(call_id, language, question_text)
        logger.info(f"📞 Opening TTS ready for call {call_id} ({language})")
    except Exception as e:
        logger.error(f"📞 TTS pre-generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {e}")

    # Place call immediately; generate confirmation MP3s in background while patient listens
    priority_langs = list(dict.fromkeys([language, "en", "hi", "kn"]))
    try:
        call_sid = create_outbound_call(config, phone_number, call_log.id, language)

        call_log.call_sid = call_sid
        call_log.status = "initiated"
        db.commit()

        logger.info(f"📞 Call initiated: SID={call_sid}, to={phone_number}, lang={language}")

        background_tasks.add_task(pregenerate_confirmation_audio, call_id, priority_langs)
        background_tasks.add_task(cleanup_old_audio_files)

        return JSONResponse(content={
            "success": True,
            "call_sid": call_sid,
            "call_log_id": call_log.id,
            "status": "initiated",
            "phone_number": phone_number,
            "question": question_text_en,
            "language": language,
        })

    except Exception as e:
        call_log.status = "failed"
        db.commit()
        logger.error(f"📞 Twilio call creation failed: {e}")
        err = str(e)
        if "timed out" in err.lower():
            err = (
                "Connection to Twilio timed out. Check internet/firewall/VPN, then retry. "
                "If the problem persists, try again in a few minutes."
            )
        raise HTTPException(status_code=500, detail=f"Failed to initiate call: {err}")


def _play_or_say(response, audio_base: str, filename: str, fallback_text: str, voice: str = "alice"):
    """Play pre-generated MP3 if present; otherwise speak text so the call never fails silently."""
    if os.path.exists(_audio_filepath(filename)):
        response.play(f"{audio_base}/{filename}")
    else:
        logger.warning(f"📞 Missing audio {filename}, using <Say> fallback")
        response.say(fallback_text, voice=voice)


@router.api_route("/voice-webhook", methods=["GET", "POST"])
async def voice_webhook(call_log_id: int, lang: str = "en", db: Session = Depends(get_db)):
    """
    TwiML webhook — called by Twilio when the patient picks up.
    Question is asked in the PATIENT'S SELECTED LANGUAGE via Sarvam AI TTS.
    Records patient's response via <Record>, then sends to Deepgram for STT.
    """
    from twilio.twiml.voice_response import VoiceResponse

    try:
        call_log = db.query(models.TwilioCallLog).filter(models.TwilioCallLog.id == call_log_id).first()
        config = get_twilio_config()
        if not config:
            raise ValueError("Twilio not configured")
        base_url = config["webhook_base_url"]

        response = VoiceResponse()

        if not call_log:
            response.say("Sorry, we could not find your call information. Goodbye.", voice="alice")
            response.hangup()
            return Response(content=str(response), media_type="application/xml")

        if lang not in SUPPORTED_LANG_CODES:
            lang = "en"

        q_map = HEALTH_QUESTIONS_ML.get(0, HEALTH_QUESTIONS_ML[0])
        question_text = call_log.question_text or q_map.get(lang, q_map["en"])
        greeting_text = GREETING_TEXT.get(lang, GREETING_TEXT["en"])
        prompt_text = ANSWER_PROMPT_TEXT.get(lang, ANSWER_PROMPT_TEXT["en"])

        audio_base = f"{base_url}/api/twilio/serve-audio"

        _play_or_say(response, audio_base, f"greeting_{call_log_id}.mp3", greeting_text)
        response.pause(length=1)
        _play_or_say(response, audio_base, f"question_{call_log_id}.mp3", question_text)
        response.pause(length=1)
        _play_or_say(response, audio_base, f"prompt_{call_log_id}.mp3", prompt_text)

        response.record(
            action=f"{base_url}/api/twilio/process-recording?call_log_id={call_log_id}&lang={lang}",
            max_length=10,
            play_beep=True,
            trim="trim-silence",
            timeout=5,
            recording_status_callback=f"{base_url}/api/twilio/recording-status?call_log_id={call_log_id}",
        )

        fallback_text = RESPONSE_UNCLEAR.get(lang, RESPONSE_UNCLEAR["en"])
        fallback_file = f"fallback_{call_log_id}.mp3"
        try:
            if not os.path.exists(_audio_filepath(fallback_file)):
                generate_tts_file(fallback_text, lang, fallback_file)
            _play_or_say(response, audio_base, fallback_file, fallback_text)
        except Exception:
            response.say("We did not receive your response. Goodbye.", voice="alice")
        response.hangup()

        call_log.status = "in-progress"
        db.commit()

        logger.info(f"📞 Voice webhook served for call_log_id={call_log_id}, lang={lang}")
        return Response(content=str(response), media_type="application/xml")

    except Exception as e:
        logger.exception(f"📞 Voice webhook error for call_log_id={call_log_id}: {e}")
        from twilio.twiml.voice_response import VoiceResponse as VR
        err = VR()
        err.say("Sorry, a technical error occurred. Please try again later.", voice="alice")
        err.hangup()
        return Response(content=str(err), media_type="application/xml")


@router.post("/process-recording")
async def process_recording(
    request: Request,
    background_tasks: BackgroundTasks,
    call_log_id: int,
    lang: str = "en",
    db: Session = Depends(get_db),
):
    """
    Called by Twilio after <Record> captures the patient's audio.
    Downloads the recording, sends it to Deepgram Nova-3 for transcription,
    then runs intent classification and plays a Sarvam TTS confirmation.
    """
    from twilio.twiml.voice_response import VoiceResponse

    form = await request.form()
    recording_url = form.get("RecordingUrl", "")
    recording_sid = form.get("RecordingSid", "")

    call_log = db.query(models.TwilioCallLog).filter(models.TwilioCallLog.id == call_log_id).first()
    config = get_twilio_config()
    base_url = config["webhook_base_url"] if config else ""

    response = VoiceResponse()

    if not call_log:
        response.say("We could not process your response. Goodbye.", voice="alice")
        response.hangup()
        return Response(content=str(response), media_type="application/xml")

    # --- Transcribe with Deepgram Nova-3 (auto language detection) ---
    speech_result = ""
    confidence = 0.0
    deepgram_detected_lang = lang  # fallback to selected language
    try:
        if recording_url:
            # Twilio recording URL needs .wav suffix for direct access
            audio_url = f"{recording_url}.wav"
            dg_result = transcribe_with_deepgram(audio_url, lang)
            speech_result = dg_result["transcript"].strip()
            confidence = dg_result["confidence"]
            deepgram_detected_lang = dg_result.get("detected_language", lang)
        else:
            logger.warning(f"📞 No RecordingUrl in callback for call_log_id={call_log_id}")
    except Exception as e:
        logger.error(f"📞 Deepgram transcription failed: {e}")
        speech_result = ""
        confidence = 0.0

    # Save transcript (preserve native script — do not force .lower() before classification)
    call_log.transcript = speech_result

    # Classify intent in ANY language (independent of UI-selected question language)
    intent, intent_conf, detected_response_lang = classify_call_response(speech_result, confidence)
    if intent == "Unclear" and deepgram_detected_lang not in ("en",):
        detected_response_lang = deepgram_detected_lang

    logger.info(
        f"📞 Intent: transcript='{speech_result}', intent={intent}, "
        f"spoken_lang={detected_response_lang}, question_lang={lang}, "
        f"stt_conf={confidence:.2f}, intent_conf={intent_conf:.2f}"
    )

    call_log.intent = intent
    call_log.detected_language = detected_response_lang

    response_lang = detected_response_lang if detected_response_lang in SUPPORTED_LANG_CODES else lang
    if intent == "Yes":
        confirmation = random.choice(RESPONSE_YES.get(response_lang, RESPONSE_YES["en"]))
    elif intent == "No":
        confirmation = random.choice(RESPONSE_NO.get(response_lang, RESPONSE_NO["en"]))
    else:
        confirmation = RESPONSE_UNCLEAR.get(response_lang, RESPONSE_UNCLEAR["en"])

    call_log.response_text = confirmation
    call_log.status = "completed"
    call_log.duration = 0
    db.commit()

    # Respond immediately: play pre-generated MP3 if ready, else instant Twilio <Say> (no Sarvam wait)
    conf_file = _resolve_confirmation_file(call_log_id, intent, response_lang)
    if conf_file:
        response.play(f"{base_url}/api/twilio/serve-audio/{conf_file}")
        logger.info(f"📞 Playing pre-generated: {conf_file}")
    else:
        say_text = _short_confirmation_text(intent, response_lang)
        say_voice = TWILIO_SAY_VOICE.get(response_lang, "Polly.Joanna")
        response.say(say_text, voice=say_voice, language=TWILIO_SPEECH_LANG.get(response_lang, "en-IN"))
        logger.info(f"📞 Instant Say fallback ({response_lang}): {say_text[:40]}...")
    response.pause(length=1)
    response.hangup()

    if background_tasks:
        background_tasks.add_task(
            _save_interview_response,
            call_log_id, speech_result, response_lang, intent, confirmation,
        )

    logger.info(
        f"📞 ✅ Call completed: intent={intent}, lang={response_lang}, "
        f"transcript='{speech_result[:50]}...', stt_conf={confidence:.2f}"
    )
    return Response(content=str(response), media_type="application/xml")


@router.post("/recording-status")
async def recording_status(call_log_id: int, request: Request):
    """Optional: Twilio recording status callback for logging."""
    form = await request.form()
    status = form.get("RecordingStatus", "unknown")
    logger.info(f"📞 Recording status for call_log_id={call_log_id}: {status}")
    return Response(content="<Response/>", media_type="application/xml")




@router.post("/status-callback")
async def status_callback(call_log_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Twilio status callback — updates call status in the database.
    Called for: initiated, ringing, answered, completed.
    """
    form = await request.form()
    call_status = form.get("CallStatus", "unknown")
    call_sid = form.get("CallSid", "")
    call_duration = form.get("CallDuration", "0")

    call_log = db.query(models.TwilioCallLog).filter(models.TwilioCallLog.id == call_log_id).first()
    if call_log:
        # Map Twilio statuses
        status_map = {
            "queued": "initiating",
            "initiated": "initiated",
            "ringing": "ringing",
            "in-progress": "in-progress",
            "completed": "completed",
            "busy": "busy",
            "no-answer": "no-answer",
            "canceled": "canceled",
            "failed": "failed",
        }
        call_log.status = status_map.get(call_status, call_status)
        if call_duration:
            call_log.duration = int(call_duration)
        call_log.updated_at = datetime.datetime.utcnow()
        db.commit()

        logger.info(f"📞 Status update: call_log_id={call_log_id}, status={call_status}")

    return Response(content="<Response/>", media_type="application/xml")


@router.get("/call-status/{call_log_id}")
async def get_call_status(call_log_id: int, db: Session = Depends(get_db)):
    """
    Get the current status and results of a Twilio call.
    Used by the frontend to poll for call completion.
    """
    call_log = db.query(models.TwilioCallLog).filter(models.TwilioCallLog.id == call_log_id).first()
    if not call_log:
        raise HTTPException(status_code=404, detail="Call not found")

    return JSONResponse(content={
        "call_log_id": call_log.id,
        "call_sid": call_log.call_sid,
        "status": call_log.status,
        "phone_number": call_log.phone_number,
        "question": call_log.question_text,
        "transcript": call_log.transcript,
        "intent": call_log.intent,
        "detected_language": call_log.detected_language,
        "detected_language_name": LANG_NAMES.get(call_log.detected_language or "", call_log.detected_language or ""),
        "response_text": call_log.response_text,
        "duration": call_log.duration,
        "created_at": call_log.created_at.isoformat() if call_log.created_at else None,
    })


@router.get("/call-logs")
async def get_call_logs(limit: int = 20, db: Session = Depends(get_db)):
    """Get recent Twilio call logs for the dashboard."""
    logs = (
        db.query(models.TwilioCallLog)
        .order_by(models.TwilioCallLog.created_at.desc())
        .limit(limit)
        .all()
    )

    result = []
    for log in logs:
        patient = None
        if log.patient_id:
            patient = db.query(models.Patient).filter(models.Patient.id == log.patient_id).first()

        result.append({
            "call_log_id": log.id,
            "call_sid": log.call_sid,
            "patient_name": patient.name if patient else "Unknown",
            "patient_id": log.patient_id,
            "phone_number": log.phone_number,
            "question": log.question_text,
            "status": log.status,
            "transcript": log.transcript,
            "intent": log.intent,
            "detected_language": log.detected_language,
            "detected_language_name": LANG_NAMES.get(log.detected_language or "", ""),
            "response_text": log.response_text,
            "duration": log.duration,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    return JSONResponse(content={"success": True, "logs": result})


@router.post("/bulk-calls")
async def initiate_bulk_calls(request: Request, db: Session = Depends(get_db)):
    """
    Initiate calls to multiple patients at once.
    Request body: { calls: [{ phone_number, patient_id, patient_name, question_id }] }
    """
    config = get_twilio_config()
    if not config:
        raise HTTPException(status_code=400, detail="Twilio not configured.")

    data = await request.json()
    calls = data.get("calls", [])
    if not calls:
        raise HTTPException(status_code=400, detail="No calls specified.")

    results = []
    from twilio.rest import Client

    client = Client(config["account_sid"], config["auth_token"])
    base_url = config["webhook_base_url"]

    for call_data in calls:
        phone_number = call_data.get("phone_number", "").strip()
        patient_id = call_data.get("patient_id")
        question_id = call_data.get("question_id", 0)

        if not phone_number:
            results.append({"phone_number": phone_number, "success": False, "error": "No phone number"})
            continue

        question = HEALTH_QUESTIONS[question_id % len(HEALTH_QUESTIONS)]
        audio_filename = f"q_{uuid.uuid4().hex[:8]}.mp3"
        generate_tts_file(question["text"], "en", audio_filename)

        patient_id_int = int(patient_id) if patient_id and str(patient_id).isdigit() else None
        call_log = models.TwilioCallLog(
            patient_id=patient_id_int,
            phone_number=phone_number,
            question_text=question["text"],
            question_audio_filename=audio_filename,
            status="initiating",
        )
        db.add(call_log)
        db.commit()
        db.refresh(call_log)

        try:
            call = client.calls.create(
                to=phone_number,
                from_=config["phone_number"],
                url=f"{base_url}/api/twilio/voice-webhook?call_log_id={call_log.id}",
                status_callback=f"{base_url}/api/twilio/status-callback?call_log_id={call_log.id}",
                status_callback_event=["initiated", "ringing", "answered", "completed"],
                timeout=30,
            )
            call_log.call_sid = call.sid
            call_log.status = "initiated"
            db.commit()
            results.append({
                "phone_number": phone_number,
                "success": True,
                "call_sid": call.sid,
                "call_log_id": call_log.id,
            })
        except Exception as e:
            call_log.status = "failed"
            db.commit()
            results.append({"phone_number": phone_number, "success": False, "error": str(e)})

    return JSONResponse(content={"success": True, "results": results})


# ──────────────────────────────────────────────────────────────
# Call Scheduler Endpoints
# ──────────────────────────────────────────────────────────────

@router.post("/schedule-call")
async def schedule_call(request: Request, db: Session = Depends(get_db)):
    """
    Schedule a medicine course call with day/time customization.
    Request body: {
        phone_number, patient_id, patient_name, question_id,
        scheduled_time (ISO: 2026-04-22T09:30),
        end_date (ISO, optional),
        recurrence ("once" | "daily" | "weekly" | "custom"),
        weekdays ("mon,tue,wed,thu,fri,sat,sun" — for custom recurrence),
        language ("en","hi","kn",...),
        notes (optional)
    }
    """
    config = get_twilio_config()
    if not config:
        raise HTTPException(status_code=400, detail="Twilio not configured.")

    data = await request.json()
    phone_number = data.get("phone_number", "").strip()
    patient_id = data.get("patient_id")
    patient_name = data.get("patient_name", "Patient")
    question_id = data.get("question_id", 0)
    scheduled_time_str = data.get("scheduled_time", "")
    end_date_str = data.get("end_date", "")
    recurrence = data.get("recurrence", "once")
    weekdays = data.get("weekdays", "")  # comma-separated: "mon,wed,fri"
    language = data.get("language", "en")
    notes = data.get("notes", "")

    if not phone_number:
        raise HTTPException(status_code=400, detail="Phone number is required.")
    if not scheduled_time_str:
        raise HTTPException(status_code=400, detail="Scheduled time is required.")

    # Parse the scheduled time (start date + time)
    try:
        scheduled_time = datetime.datetime.fromisoformat(scheduled_time_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use ISO format: YYYY-MM-DDTHH:MM")

    # Parse end date (optional, for recurring schedules)
    end_date = None
    if end_date_str:
        try:
            end_date = datetime.datetime.fromisoformat(end_date_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end date format.")

    # Select the question
    q_map = HEALTH_QUESTIONS_ML.get(question_id % len(HEALTH_QUESTIONS_ML), HEALTH_QUESTIONS_ML[0])
    question_text = q_map["en"]

    patient_id_int = int(patient_id) if patient_id and str(patient_id).isdigit() else None

    scheduled_call = models.ScheduledCall(
        patient_id=patient_id_int,
        patient_name=patient_name,
        phone_number=phone_number,
        question_id=question_id,
        question_text=question_text,
        scheduled_time=scheduled_time,
        end_date=end_date,
        recurrence=recurrence,
        weekdays=weekdays if recurrence == "custom" else None,
        language=language,
        notes=notes,
        status="pending",
    )
    db.add(scheduled_call)
    db.commit()
    db.refresh(scheduled_call)

    logger.info(f"📅 Call scheduled: id={scheduled_call.id}, to={phone_number}, time={scheduled_time}, end={end_date}, recurrence={recurrence}, weekdays={weekdays}, lang={language}")

    return JSONResponse(content={
        "success": True,
        "scheduled_call_id": scheduled_call.id,
        "phone_number": phone_number,
        "patient_name": patient_name,
        "question": question_text,
        "scheduled_time": scheduled_time.isoformat(),
        "end_date": end_date.isoformat() if end_date else None,
        "recurrence": recurrence,
        "weekdays": weekdays,
        "language": language,
        "status": "pending",
    })


@router.get("/scheduled-calls")
async def get_scheduled_calls(status: str = None, limit: int = 50, db: Session = Depends(get_db)):
    """
    Get scheduled calls, optionally filtered by status.
    """
    query = db.query(models.ScheduledCall).order_by(models.ScheduledCall.scheduled_time.asc())
    if status:
        query = query.filter(models.ScheduledCall.status == status)
    calls = query.limit(limit).all()

    result = []
    for sc in calls:
        patient = None
        if sc.patient_id:
            patient = db.query(models.Patient).filter(models.Patient.id == sc.patient_id).first()

        result.append({
            "id": sc.id,
            "patient_id": sc.patient_id,
            "patient_name": sc.patient_name or (patient.name if patient else "Unknown"),
            "phone_number": sc.phone_number,
            "question_id": sc.question_id,
            "question_text": sc.question_text,
            "scheduled_time": sc.scheduled_time.isoformat() if sc.scheduled_time else None,
            "end_date": sc.end_date.isoformat() if sc.end_date else None,
            "status": sc.status,
            "recurrence": sc.recurrence,
            "weekdays": sc.weekdays or "",
            "language": sc.language or "en",
            "call_log_id": sc.call_log_id,
            "notes": sc.notes,
            "created_at": sc.created_at.isoformat() if sc.created_at else None,
        })

    return JSONResponse(content={"success": True, "scheduled_calls": result})


@router.put("/scheduled-calls/{call_id}/cancel")
async def cancel_scheduled_call(call_id: int, db: Session = Depends(get_db)):
    """Cancel a pending scheduled call."""
    sc = db.query(models.ScheduledCall).filter(models.ScheduledCall.id == call_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scheduled call not found.")
    if sc.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot cancel call with status '{sc.status}'.")

    sc.status = "cancelled"
    sc.updated_at = datetime.datetime.utcnow()
    db.commit()

    logger.info(f"📅 Scheduled call cancelled: id={call_id}")
    return JSONResponse(content={"success": True, "status": "cancelled"})


@router.put("/scheduled-calls/{call_id}")
async def update_scheduled_call(call_id: int, request: Request, db: Session = Depends(get_db)):
    """Update a pending scheduled call (time, question, recurrence, notes)."""
    sc = db.query(models.ScheduledCall).filter(models.ScheduledCall.id == call_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scheduled call not found.")
    if sc.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot update call with status '{sc.status}'.")

    data = await request.json()

    if "scheduled_time" in data:
        try:
            sc.scheduled_time = datetime.datetime.fromisoformat(data["scheduled_time"])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid time format.")

    if "question_id" in data:
        qid = int(data["question_id"])
        sc.question_id = qid
        sc.question_text = HEALTH_QUESTIONS[qid % len(HEALTH_QUESTIONS)]["text"]

    if "recurrence" in data:
        sc.recurrence = data["recurrence"]
    if "notes" in data:
        sc.notes = data["notes"]
    if "phone_number" in data:
        sc.phone_number = data["phone_number"]

    sc.updated_at = datetime.datetime.utcnow()
    db.commit()

    logger.info(f"📅 Scheduled call updated: id={call_id}")
    return JSONResponse(content={"success": True, "status": "updated"})


@router.delete("/scheduled-calls/{call_id}")
async def delete_scheduled_call(call_id: int, db: Session = Depends(get_db)):
    """Permanently delete a scheduled call."""
    sc = db.query(models.ScheduledCall).filter(models.ScheduledCall.id == call_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scheduled call not found.")

    db.delete(sc)
    db.commit()

    logger.info(f"📅 Scheduled call deleted: id={call_id}")
    return JSONResponse(content={"success": True})


# ──────────────────────────────────────────────────────────────
# Background Scheduler — Executes due calls automatically
# ──────────────────────────────────────────────────────────────

import asyncio
import threading

_scheduler_running = False


def _execute_scheduled_call(scheduled_call_id: int, config: dict):
    """Execute a single scheduled call by initiating a Twilio call."""
    from twilio.rest import Client
    from backend.database import SessionLocal

    db = SessionLocal()
    try:
        sc = db.query(models.ScheduledCall).filter(models.ScheduledCall.id == scheduled_call_id).first()
        if not sc or sc.status != "pending":
            return

        # Mark as being processed
        sc.status = "executing"
        db.commit()

        # Use the patient's preferred language (stored on the scheduled call)
        lang = sc.language or "en"

        # Get the question text in the patient's language
        q_map = HEALTH_QUESTIONS_ML.get(sc.question_id % len(HEALTH_QUESTIONS_ML), HEALTH_QUESTIONS_ML[0])
        question_text_ml = q_map.get(lang, q_map["en"])
        question_text_en = q_map["en"]  # English for logging/display

        # Pre-generate TTS audio files in the patient's language
        call_log = models.TwilioCallLog(
            patient_id=sc.patient_id,
            phone_number=sc.phone_number,
            question_text=question_text_en,
            detected_language=lang,
            status="initiating",
        )
        db.add(call_log)
        db.commit()
        db.refresh(call_log)

        # Generate greeting, question, and prompt audio in patient's language
        call_id = call_log.id
        greeting_text = GREETING_TEXT.get(lang, GREETING_TEXT["en"])
        prompt_text = ANSWER_PROMPT_TEXT.get(lang, ANSWER_PROMPT_TEXT["en"])

        try:
            generate_tts_file(greeting_text, lang, f"greeting_{call_id}.mp3")
            generate_tts_file(question_text_ml, lang, f"question_{call_id}.mp3")
            generate_tts_file(prompt_text, lang, f"prompt_{call_id}.mp3")
            logger.info(f"📅 TTS audio generated in '{lang}' for scheduled call {call_id}")
        except Exception as e:
            logger.error(f"📅 TTS pre-generation failed for scheduled call: {e}")

        # Initiate Twilio call
        client = Client(config["account_sid"], config["auth_token"])
        base_url = config["webhook_base_url"]

        call = client.calls.create(
            to=sc.phone_number,
            from_=config["phone_number"],
            url=f"{base_url}/api/twilio/voice-webhook?call_log_id={call_log.id}&lang={lang}",
            status_callback=f"{base_url}/api/twilio/status-callback?call_log_id={call_log.id}",
            status_callback_event=["initiated", "ringing", "answered", "completed"],
            timeout=30,
        )

        call_log.call_sid = call.sid
        call_log.status = "initiated"
        sc.call_log_id = call_log.id
        sc.status = "completed"
        sc.updated_at = datetime.datetime.utcnow()
        db.commit()

        logger.info(f"📅 ✅ Scheduled call executed: id={sc.id}, call_sid={call.sid}")

        # Handle recurrence — schedule the next occurrence
        if sc.recurrence == "daily":
            next_time = sc.scheduled_time + datetime.timedelta(days=1)
            # Only schedule next if there's no end date, or next time is on/before end date
            if not sc.end_date or next_time <= sc.end_date:
                new_sc = models.ScheduledCall(
                    patient_id=sc.patient_id,
                    patient_name=sc.patient_name,
                    phone_number=sc.phone_number,
                    question_id=sc.question_id,
                    question_text=sc.question_text,
                    scheduled_time=next_time,
                    end_date=sc.end_date,
                    recurrence="daily",
                    language=sc.language,
                    notes=sc.notes,
                    status="pending",
                )
                db.add(new_sc)
                db.commit()
                logger.info(f"📅 Next daily call scheduled: time={next_time}")
            else:
                logger.info(f"📅 Daily call reached end date ({sc.end_date}), stopping recurrence.")

        elif sc.recurrence == "weekly":
            next_time = sc.scheduled_time + datetime.timedelta(weeks=1)
            if not sc.end_date or next_time <= sc.end_date:
                new_sc = models.ScheduledCall(
                    patient_id=sc.patient_id,
                    patient_name=sc.patient_name,
                    phone_number=sc.phone_number,
                    question_id=sc.question_id,
                    question_text=sc.question_text,
                    scheduled_time=next_time,
                    end_date=sc.end_date,
                    recurrence="weekly",
                    language=sc.language,
                    notes=sc.notes,
                    status="pending",
                )
                db.add(new_sc)
                db.commit()
                logger.info(f"📅 Next weekly call scheduled: time={next_time}")
            else:
                logger.info(f"📅 Weekly call reached end date ({sc.end_date}), stopping recurrence.")


    except Exception as e:
        logger.error(f"📅 ❌ Scheduled call execution failed for id={scheduled_call_id}: {e}")
        try:
            sc = db.query(models.ScheduledCall).filter(models.ScheduledCall.id == scheduled_call_id).first()
            if sc:
                sc.status = "failed"
                sc.updated_at = datetime.datetime.utcnow()
                db.commit()
        except:
            pass
    finally:
        db.close()


def _scheduler_loop():
    """Background loop that checks for due scheduled calls every 30 seconds."""
    global _scheduler_running

    while _scheduler_running:
        try:
            config = get_twilio_config()
            if not config:
                time.sleep(30)
                continue

            db = SessionLocal()
            try:
                now = datetime.datetime.utcnow()
                due_calls = (
                    db.query(models.ScheduledCall)
                    .filter(
                        models.ScheduledCall.status == "pending",
                        models.ScheduledCall.scheduled_time <= now,
                    )
                    .all()
                )

                for sc in due_calls:
                    logger.info(f"📅 Executing due scheduled call: id={sc.id}, time={sc.scheduled_time}")
                    _execute_scheduled_call(sc.id, config)

            except Exception as e:
                logger.error(f"📅 Scheduler check error: {e}")
            finally:
                db.close()

        except Exception as e:
            logger.error(f"📅 Scheduler loop error: {e}")

        time.sleep(30)


def start_scheduler():
    """Start the background scheduler thread."""
    global _scheduler_running
    if _scheduler_running:
        return

    _scheduler_running = True
    thread = threading.Thread(target=_scheduler_loop, daemon=True, name="call-scheduler")
    thread.start()
    logger.info("📅 Call scheduler started (checking every 30s)")


def stop_scheduler():
    """Stop the background scheduler thread."""
    global _scheduler_running
    _scheduler_running = False
    logger.info("📅 Call scheduler stopped")

