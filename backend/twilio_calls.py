"""
Twilio Phone Call Integration for Voice Assistant (GPU-Free)

Handles the complete lifecycle of automated medication adherence phone calls:
1. Initiate outbound call via Twilio REST API
2. Play health-check question via TwiML <Say> (English)
3. Capture patient's spoken answer via TwiML <Gather speech> (Twilio's built-in ASR)
4. Classify intent using keyword matching (CPU only)
5. Generate multilingual TTS confirmation via gTTS
6. Play confirmation to patient and hang up
7. Log everything to the database
"""

import os
import uuid
import time
import random
import logging
import datetime

from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from fastapi.responses import Response, FileResponse, JSONResponse
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.twilio_config import get_twilio_config, is_twilio_configured, validate_twilio_connection
from backend.constants import (
    HEALTH_QUESTIONS, INTENT_KEYWORDS, RESPONSE_YES, RESPONSE_NO,
    RESPONSE_UNCLEAR, GTTS_LANG_MAP, LANG_NAMES,
    SUPPORTED_LANG_CODES, TWILIO_SPEECH_LANG,
    GREETING_TEXT, ANSWER_PROMPT_TEXT, HEALTH_QUESTIONS_ML,
)
import backend.models as models

logger = logging.getLogger("twilio-calls")

router = APIRouter()

# ──────────────────────────────────────────────────────────────
# Temp Audio Directory (for serving TTS files to Twilio)
# ──────────────────────────────────────────────────────────────
TEMP_AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "temp_audio")
os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



# ──────────────────────────────────────────────────────────────
# NOTE: GPU ASR functions (preprocess_recording, run_asr_pipeline)
# were removed. Twilio's built-in <Gather speech> handles all
# speech recognition — no GPU, torch, or whisper needed.
# ──────────────────────────────────────────────────────────────



def generate_tts_file(text: str, lang: str, filename: str) -> str:
    """Generate a TTS MP3 file and return its path."""
    import tempfile
    from gtts import gTTS

    tts_lang = GTTS_LANG_MAP.get(lang, "en")
    # Use a dedicated temp directory for audio files
    audio_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_audio")
    os.makedirs(audio_dir, exist_ok=True)
    filepath = os.path.join(audio_dir, filename)

    try:
        tts = gTTS(text=text, lang=tts_lang)
        tts.save(filepath)
        return filepath
    except Exception as e:
        logger.error(f"TTS generation failed for lang '{tts_lang}': {e}")
        # Fallback to English
        tts = gTTS(text=text, lang="en")
        tts.save(filepath)
        return filepath


def cleanup_old_audio_files():
    """Delete temp audio files older than 1 hour."""
    audio_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_audio")
    if not os.path.exists(audio_dir):
        return
    cutoff = time.time() - 3600
    for filename in os.listdir(audio_dir):
        filepath = os.path.join(audio_dir, filename)
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
    """Check if Twilio is configured and test the connection."""
    if not is_twilio_configured():
        return JSONResponse(content={
            "configured": False,
            "message": "Twilio credentials not found. Create a .env file with TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and TWILIO_WEBHOOK_BASE_URL."
        })

    success, message = validate_twilio_connection()
    return JSONResponse(content={
        "configured": True,
        "connected": success,
        "message": message,
        "webhook_base_url": get_twilio_config()["webhook_base_url"] if success else None,
    })


@router.get("/serve-audio/{filename}")
async def serve_audio(filename: str):
    """Serve a generated TTS audio file to Twilio's <Play> verb."""
    from fastapi.responses import FileResponse

    audio_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_audio")
    filepath = os.path.join(audio_dir, filename)

    if not os.path.exists(filepath):
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

    # Pre-generate TTS audio files in the patient's language
    call_id = call_log.id
    greeting_text = GREETING_TEXT.get(language, GREETING_TEXT["en"])
    prompt_text = ANSWER_PROMPT_TEXT.get(language, ANSWER_PROMPT_TEXT["en"])

    try:
        generate_tts_file(greeting_text, language, f"greeting_{call_id}.mp3")
        generate_tts_file(question_text, language, f"question_{call_id}.mp3")
        generate_tts_file(prompt_text, language, f"prompt_{call_id}.mp3")
        logger.info(f"📞 TTS audio generated in '{language}' for call {call_id}")
    except Exception as e:
        logger.error(f"📞 TTS pre-generation failed: {e}")

    # Create Twilio outbound call
    try:
        from twilio.rest import Client

        client = Client(config["account_sid"], config["auth_token"])
        base_url = config["webhook_base_url"]

        call = client.calls.create(
            to=phone_number,
            from_=config["phone_number"],
            url=f"{base_url}/api/twilio/voice-webhook?call_log_id={call_log.id}&lang={language}",
            status_callback=f"{base_url}/api/twilio/status-callback?call_log_id={call_log.id}",
            status_callback_event=["initiated", "ringing", "answered", "completed"],
            timeout=30,
        )

        call_log.call_sid = call.sid
        call_log.status = "initiated"
        db.commit()

        logger.info(f"📞 Call initiated: SID={call.sid}, to={phone_number}, lang={language}, question='{question_text}'")

        background_tasks.add_task(cleanup_old_audio_files)

        return JSONResponse(content={
            "success": True,
            "call_sid": call.sid,
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
        raise HTTPException(status_code=500, detail=f"Failed to initiate call: {str(e)}")


@router.post("/voice-webhook")
async def voice_webhook(call_log_id: int, lang: str = "en", db: Session = Depends(get_db)):
    """
    TwiML webhook — called by Twilio when the patient picks up.
    Question is asked in the PATIENT'S SELECTED LANGUAGE via gTTS <Play>.
    Listens for patient's response in their language via <Gather speech>.
    NO GPU required.
    """
    from twilio.twiml.voice_response import VoiceResponse, Gather

    call_log = db.query(models.TwilioCallLog).filter(models.TwilioCallLog.id == call_log_id).first()
    config = get_twilio_config()
    base_url = config["webhook_base_url"] if config else ""

    response = VoiceResponse()

    if not call_log:
        response.say("Sorry, we could not find your call information. Goodbye.", voice="alice")
        response.hangup()
        return Response(content=str(response), media_type="application/xml")

    if lang not in SUPPORTED_LANG_CODES:
        lang = "en"

    # --- Play greeting, question, and prompt in patient's language ---
    audio_base = f"{base_url}/api/twilio/serve-audio"

    # Play greeting in patient's language
    response.play(f"{audio_base}/greeting_{call_log_id}.mp3")
    response.pause(length=1)

    # Play the health question in patient's language
    response.play(f"{audio_base}/question_{call_log_id}.mp3")
    response.pause(length=1)

    # Play the answer prompt in patient's language
    response.play(f"{audio_base}/prompt_{call_log_id}.mp3")

    # Listen for patient's response using Twilio's ASR
    # Use en-IN with enhanced model for best cross-language recognition
    twilio_lang = TWILIO_SPEECH_LANG.get(lang, "en-IN")
    
    gather = Gather(
        input="speech",
        language="en-IN",
        action=f"{base_url}/api/twilio/process-speech?call_log_id={call_log_id}&lang={lang}",
        timeout=15,
        speech_timeout=3,
        hints="yes, no, yeah, nope, okay, done, took it, i did, i have, not yet, forgot, haan, ha, ji, nahi, na, nahin, le liya, nahi liya, kha liya, nahi khaya, haudu, illa, ho, nako",
        enhanced=True,
    )
    response.append(gather)

    # Fallback if no speech detected at all
    fallback_text = RESPONSE_UNCLEAR.get(lang, RESPONSE_UNCLEAR["en"])
    fallback_file = f"fallback_{call_log_id}.mp3"
    try:
        generate_tts_file(fallback_text, lang, fallback_file)
        response.play(f"{audio_base}/{fallback_file}")
    except Exception:
        response.say("We did not receive your response. Goodbye.", voice="alice")
    response.hangup()

    call_log.status = "in-progress"
    db.commit()

    logger.info(f"📞 Voice webhook served for call_log_id={call_log_id}, lang={lang}, primary_speech=en-IN, fallback_speech={twilio_lang}")
    return Response(content=str(response), media_type="application/xml")


@router.post("/process-speech")
async def process_speech(
    call_log_id: int,
    lang: str = "en",
    request: Request = None,
    db: Session = Depends(get_db),
):
    """
    Called by Twilio after <Gather speech> captures the patient's answer.
    Twilio provides the transcription — NO GPU/ASR needed on our end.
    Runs intent classification, generates multilingual TTS response, plays it.
    """
    from twilio.twiml.voice_response import VoiceResponse

    form = await request.form()
    speech_result = form.get("SpeechResult", "").strip().lower()
    confidence = float(form.get("Confidence", "0") or "0")

    call_log = db.query(models.TwilioCallLog).filter(models.TwilioCallLog.id == call_log_id).first()
    config = get_twilio_config()
    base_url = config["webhook_base_url"] if config else ""

    response = VoiceResponse()

    if not call_log:
        response.say("We could not process your response. Goodbye.", voice="alice")
        response.hangup()
        return Response(content=str(response), media_type="application/xml")

    # Save transcript from Twilio's speech recognition
    call_log.transcript = speech_result
    call_log.detected_language = lang

    # Run robust intent classification (CPU only)
    # Twilio telephony transcripts are often noisy — we use multi-strategy matching:
    # 1. Fuzzy romanized matching (detects language from keywords)
    # 2. Native script keyword dictionaries
    # 3. Short response prefix matching
    # Also tracks which language the patient ACTUALLY spoke in.

    intent = "Unclear"
    detected_response_lang = lang  # Default to selected language
    transcript = speech_result.strip().lower()
    
    # Split transcript into individual words for word-level matching
    words = transcript.split()

    # --- Strategy 1: Fuzzy romanized patterns mapped to their language ---
    YES_FUZZY_LANG = {
        "en": ["yes", "yeah", "yep", "yup", "yah", "yea", "ok", "okay", "sure", "done", "right", "correct", "i did", "i have", "i took", "took it", "had it", "taken"],
        "hi": ["haan", "haa", "han", "hn", "ji", "le liya", "kha liya", "liya", "khaya", "khai"],
        "kn": ["haudu", "howdu", "agide", "hoo"],
        "mr": ["ho", "hoye", "ghetale", "gheli"],
        "ta": ["aam", "aama", "eduthen", "saptiten"],
        "te": ["avunu", "avunandi", "veskunna"],
        "bn": ["hyaa", "niyechi", "kheyechi"],
        "ml": ["athe", "kazhichu", "eduthu"],
        "gu": ["haa", "lidhi", "khadhi"],
        "pa": ["haanji", "lai", "kha lai"],
    }
    NO_FUZZY_LANG = {
        "en": ["no", "nope", "nah", "nay", "not", "not yet", "haven't", "didn't", "forgot", "missed", "skip"],
        "hi": ["nahi", "nahin", "nai", "nahi liya", "nahi khaya", "nahi li", "bhool gaya"],
        "kn": ["illa", "beda", "agilla"],
        "mr": ["nahi", "nako", "nay", "ghetale nahi"],
        "ta": ["illai", "illa", "podala", "edukala"],
        "te": ["ledu", "kaadu", "vesukoledu"],
        "bn": ["na", "niini", "khaini"],
        "ml": ["illa", "kazhichilla"],
        "gu": ["na", "nathi", "lidhi nathi"],
        "pa": ["nahi", "nai lyi"],
    }
    
    # Check NO first (to avoid false positives from "na" in longer words)
    for fuzzy_lang, fuzzy_words in NO_FUZZY_LANG.items():
        for w in words:
            if w in fuzzy_words:
                intent = "No"
                detected_response_lang = fuzzy_lang
                break
        if intent != "Unclear":
            break
    if intent == "Unclear":
        for fuzzy_lang, fuzzy_words in NO_FUZZY_LANG.items():
            for phrase in fuzzy_words:
                if " " in phrase and phrase in transcript:
                    intent = "No"
                    detected_response_lang = fuzzy_lang
                    break
            if intent != "Unclear":
                break

    # Check YES
    if intent == "Unclear":
        for fuzzy_lang, fuzzy_words in YES_FUZZY_LANG.items():
            for w in words:
                if w in fuzzy_words:
                    intent = "Yes"
                    detected_response_lang = fuzzy_lang
                    break
            if intent != "Unclear":
                break
    if intent == "Unclear":
        for fuzzy_lang, fuzzy_words in YES_FUZZY_LANG.items():
            for phrase in fuzzy_words:
                if " " in phrase and phrase in transcript:
                    intent = "Yes"
                    detected_response_lang = fuzzy_lang
                    break
            if intent != "Unclear":
                break

    # --- Strategy 2: Check all native-script keyword dictionaries ---
    if intent == "Unclear":
        for lc, kw in INTENT_KEYWORDS.items():
            if any(w in transcript for w in kw.get("no", [])):
                intent = "No"
                detected_response_lang = lc
                break
    if intent == "Unclear":
        for lc, kw in INTENT_KEYWORDS.items():
            if any(w in transcript for w in kw.get("yes", [])):
                intent = "Yes"
                detected_response_lang = lc
                break
    
    # --- Strategy 3: Short response prefix matching ---
    if intent == "Unclear" and len(words) <= 2:
        for w in words:
            if w.startswith(("ye", "ya", "ha", "ji", "ok", "su", "do", "ri")):
                intent = "Yes"
                detected_response_lang = "en"  # Assume English-like
                break
            elif w.startswith(("no", "na", "ni", "ne")):
                intent = "No"
                detected_response_lang = "en"
                break

    logger.info(f"📞 Intent detection: transcript='{speech_result}', intent={intent}, spoken_lang={detected_response_lang}, selected_lang={lang}, confidence={confidence}")

    call_log.intent = intent
    call_log.detected_language = detected_response_lang

    # Generate confirmation response in the LANGUAGE THE PATIENT ACTUALLY SPOKE
    response_lang = detected_response_lang
    if intent == "Yes":
        confirmation = random.choice(RESPONSE_YES.get(response_lang, RESPONSE_YES["en"]))
    elif intent == "No":
        confirmation = random.choice(RESPONSE_NO.get(response_lang, RESPONSE_NO["en"]))
    else:
        confirmation = RESPONSE_UNCLEAR.get(lang, RESPONSE_UNCLEAR["en"])  # Fallback to selected lang

    call_log.response_text = confirmation
    call_log.status = "completed"
    call_log.duration = 0
    db.commit()

    # Generate and play TTS confirmation in the detected spoken language
    conf_file = f"conf_{uuid.uuid4().hex[:8]}.mp3"
    generate_tts_file(confirmation, response_lang, conf_file)
    response.play(f"{base_url}/api/twilio/serve-audio/{conf_file}")
    response.pause(length=1)
    response.hangup()

    # Save to InterviewResponse for dashboard correlation
    try:
        patient_id_int = call_log.patient_id
        if patient_id_int:
            today = datetime.datetime.utcnow().date()
            existing_session = db.query(models.InterviewSession).filter(
                models.InterviewSession.patient_id == patient_id_int,
                models.InterviewSession.start_time >= datetime.datetime(today.year, today.month, today.day),
            ).first()
            if existing_session:
                db_session_id = existing_session.id
            else:
                new_session = models.InterviewSession(patient_id=patient_id_int)
                db.add(new_session)
                db.commit()
                db.refresh(new_session)
                db_session_id = new_session.id
            new_response = models.InterviewResponse(
                session_id=db_session_id,
                assistant_question=call_log.question_text,
                patient_transcript=speech_result,
                detected_language=lang,
                intent=intent,
                call_type="twilio",
                ai_response_text=confirmation,
            )
            db.add(new_response)
            db.commit()
    except Exception as e:
        logger.error(f"📞 Failed to save InterviewResponse: {e}")

    logger.info(f"📞 ✅ Call completed: intent={intent}, lang={lang}, transcript='{speech_result}', confidence={confidence}")
    return Response(content=str(response), media_type="application/xml")






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


@router.get("/serve-audio/{filename}")
async def serve_audio(filename: str):
    """Serve a pre-generated TTS audio file to Twilio."""
    filepath = os.path.join(TEMP_AUDIO_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(filepath, media_type="audio/mpeg")


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

