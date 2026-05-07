"""
Multilingual Assistive Voice AI - FastAPI Backend

Loads the IndicConformer-600M model on GPU, processes browser audio
(resample to 16 kHz mono), transcribes speech, and classifies intent.
"""

import os
import tempfile
import logging

import torch
import torchaudio
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form, Depends
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from backend.intent import classify_intent
import backend.models as models
import backend.schemas as schemas
from backend.database import SessionLocal, engine
from backend import shared_state
from backend.twilio_calls import router as twilio_router, start_scheduler as start_call_scheduler
from backend.constants import (
    WHISPER_TO_INDIC_MAP, INITIAL_QUESTIONS_EN, INTENT_KEYWORDS,
    RESPONSE_YES, RESPONSE_NO, RESPONSE_UNCLEAR, HEALTH_QUESTIONS,
    GTTS_LANG_MAP, LANG_NAMES,
)

models.Base.metadata.create_all(bind=engine)

# -- SQLite Migrations (add new columns to existing tables) --
try:
    import sqlite3
    _db_path = engine.url.database
    if _db_path:
        _conn = sqlite3.connect(_db_path)
        _cur = _conn.cursor()
        for _col, _type, _default in [
            ("call_type", "TEXT", "'browser'"),
            ("ai_response_text", "TEXT", "NULL"),
        ]:
            try:
                _cur.execute(f"ALTER TABLE responses ADD COLUMN {_col} {_type} DEFAULT {_default}")
            except Exception:
                pass

        # Ensure twilio_call_logs table exists
        _cur.execute("""
            CREATE TABLE IF NOT EXISTS twilio_call_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_sid TEXT UNIQUE,
                patient_id INTEGER REFERENCES patients(id),
                phone_number TEXT NOT NULL,
                question_text TEXT,
                question_audio_filename TEXT,
                status TEXT DEFAULT 'initiating',
                duration INTEGER,
                recording_url TEXT,
                recording_sid TEXT,
                transcript TEXT,
                intent TEXT,
                detected_language TEXT,
                response_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Ensure scheduled_calls table exists
        _cur.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_calls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER REFERENCES patients(id),
                patient_name TEXT,
                phone_number TEXT NOT NULL,
                question_id INTEGER DEFAULT 0,
                question_text TEXT,
                scheduled_time TIMESTAMP NOT NULL,
                end_date TIMESTAMP,
                status TEXT DEFAULT 'pending',
                recurrence TEXT DEFAULT 'once',
                call_log_id INTEGER,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        _conn.commit()
        _conn.close()
except Exception:
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ----------------------------------------------------------------
# Logging Configuration
# ----------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-ai")

import traceback
import random
import base64
import json
import datetime
from gtts import gTTS
import numpy as np

from transformers import WhisperProcessor, WhisperForConditionalGeneration

# ----------------------------------------------------------------
# FastAPI Application
# ----------------------------------------------------------------
app = FastAPI(
    title="Multilingual Assistive Voice AI",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Mount Twilio phone-call router
app.include_router(twilio_router, prefix="/api/twilio")

# ----------------------------------------------------------------
# Global model references (populated at startup)
# ----------------------------------------------------------------
model = None
device = None
whisper_processor = None
whisper_model = None


@app.on_event("startup")
async def load_model():
    """Load IndicConformer and Whisper models onto GPU at server startup."""
    global model, device, whisper_processor, whisper_model
    
    # Start the call scheduler (independent of CUDA/GPU)
    start_call_scheduler()
    
    if not torch.cuda.is_available():
        logger.warning("CUDA is NOT available. ASR/voice processing will be disabled, but Twilio and API endpoints will still work.")
        return

    device = torch.device("cuda")
    logger.info(f"CUDA device: {torch.cuda.get_device_name(0)}")

    try:
        # 1. Load IndicConformer (ASR)
        from transformers import AutoModel
        MODEL_ID = "ai4bharat/indic-conformer-600m-multilingual"
        logger.info(f"Loading model from {MODEL_ID} ...")
        model = AutoModel.from_pretrained(
            MODEL_ID,
            trust_remote_code=True,
            token=os.environ.get("HF_TOKEN"),
        )
        model.to(device)
        model.eval()
        logger.info("IndicConformer loaded and ready on GPU")

        # 2. Load Whisper-Small in half-precision (fp16)
        logger.info("Loading Whisper-Small (fp16) for Language Identification...")
        whisper_processor = WhisperProcessor.from_pretrained("openai/whisper-small")
        whisper_model = WhisperForConditionalGeneration.from_pretrained(
            "openai/whisper-small",
            torch_dtype=torch.float16
        ).to(device)
        whisper_model.eval()
        logger.info("Whisper-Small (fp16) loaded and ready on GPU")

        # Store model references in shared_state for other modules (e.g., twilio_calls)
        shared_state.model = model
        shared_state.device = device
        shared_state.whisper_processor = whisper_processor
        shared_state.whisper_model = whisper_model
        logger.info("Model references stored in shared_state")

    except Exception as e:
        logger.error(f"Failed to load models: {e}")


# ----------------------------------------------------------------
# Audio pre-processing helper
# ----------------------------------------------------------------
import subprocess

TARGET_SAMPLE_RATE = 16_000

def preprocess_audio(audio_bytes: bytes) -> torch.Tensor:
    """
    Convert raw audio bytes (e.g. WebM/OGG from browser) to a mono 16 kHz float32 tensor.
    Uses ffmpeg to forcefully convert it to WAV.
    """
    tmp_in = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
    tmp_out = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        tmp_in.write(audio_bytes)
        tmp_in.flush()
        tmp_in.close()
        tmp_out.close()

        cmd = [
            "ffmpeg",
            "-y",
            "-i", tmp_in.name,
            "-ac", "1",
            "-ar", str(TARGET_SAMPLE_RATE),
            "-f", "wav",
            tmp_out.name
        ]
        
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        waveform, sr = torchaudio.load(tmp_out.name)
        
        return waveform.squeeze(0)

    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg conversion failed: {e}")
        raise RuntimeError("FFmpeg could not convert the uploaded audio format.")
    finally:
        if os.path.exists(tmp_in.name):
            os.unlink(tmp_in.name)
        if os.path.exists(tmp_out.name):
            os.unlink(tmp_out.name)


# ----------------------------------------------------------------
# API Endpoints - Patient, Appointment, Medication, Session, Dashboard
# ----------------------------------------------------------------

@app.post("/api/patients", response_model=schemas.PatientResponse)
def create_patient(patient: schemas.PatientCreate, db: Session = Depends(get_db)):
    db_patient = models.Patient(**patient.model_dump())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient

@app.get("/api/patients", response_model=list[schemas.PatientResponse])
def get_patients(db: Session = Depends(get_db)):
    return db.query(models.Patient).all()

@app.put("/api/patients/{patient_id}", response_model=schemas.PatientResponse)
def update_patient(patient_id: int, patient: schemas.PatientCreate, db: Session = Depends(get_db)):
    db_patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    for key, value in patient.model_dump().items():
        setattr(db_patient, key, value)
    db.commit()
    db.refresh(db_patient)
    return db_patient

@app.delete("/api/patients/{patient_id}")
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    db_patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    db.delete(db_patient)
    db.commit()
    return {"ok": True}

@app.post("/api/appointments", response_model=schemas.AppointmentResponse)
def create_appointment(appt: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    db_appt = models.Appointment(**appt.model_dump())
    db.add(db_appt)
    db.commit()
    db.refresh(db_appt)
    return db_appt

@app.get("/api/appointments", response_model=list[schemas.AppointmentResponse])
def get_appointments(db: Session = Depends(get_db)):
    return db.query(models.Appointment).order_by(models.Appointment.date.asc()).all()

@app.post("/api/medications", response_model=schemas.MedicationResponse)
def create_medication(med: schemas.MedicationCreate, db: Session = Depends(get_db)):
    db_med = models.Medication(**med.model_dump())
    db.add(db_med)
    db.commit()
    db.refresh(db_med)
    return db_med

@app.get("/api/medications", response_model=list[schemas.MedicationResponse])
def get_medications(db: Session = Depends(get_db)):
    return db.query(models.Medication).all()

@app.post("/api/sessions", response_model=schemas.SessionResponse)
def create_session(session: schemas.SessionCreate, db: Session = Depends(get_db)):
    db_session = models.InterviewSession(**session.model_dump())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@app.get("/api/patients/{patient_id}/history", response_model=list[schemas.SessionHistoryResponse])
def get_patient_history(patient_id: int, db: Session = Depends(get_db)):
    sessions = db.query(models.InterviewSession).filter(models.InterviewSession.patient_id == patient_id).all()
    return sessions

@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_patients = db.query(models.Patient).count()
    
    today = datetime.datetime.utcnow().date()
    calls_today = db.query(models.InterviewSession).filter(
        models.InterviewSession.start_time >= datetime.datetime(today.year, today.month, today.day)
    ).count()
    
    upcoming_appointments = db.query(models.Appointment).filter(
        models.Appointment.date >= datetime.datetime.utcnow()
    ).count()
    
    total_responses = db.query(models.InterviewResponse).count()
    yes_responses = db.query(models.InterviewResponse).filter(models.InterviewResponse.intent == "Yes").count()
    adherence_rate = int((yes_responses / total_responses) * 100) if total_responses > 0 else 0
    
    return {
        "total_patients": total_patients,
        "adherence_rate": adherence_rate,
        "calls_today": calls_today,
        "upcoming_appointments": upcoming_appointments
    }

@app.get("/api/dashboard/history")
def get_recent_history(limit: int = 10, db: Session = Depends(get_db)):
    responses = db.query(models.InterviewResponse).order_by(models.InterviewResponse.timestamp.desc()).limit(limit).all()
    out = []
    for r in responses:
        out.append({
            "patient_id": r.session.patient_id if r.session else "Unknown",
            "date": r.timestamp.isoformat(),
            "question": r.assistant_question,
            "transcript": r.patient_transcript,
            "intent": r.intent,
            "detected_language": r.detected_language
        })
    return out


# ----------------------------------------------------------------
# GPU Transcription API for React OPD Frontend
# ----------------------------------------------------------------

@app.post("/api/va/transcribe-consultation")
async def transcribe_consultation(
    audio_file: UploadFile = File(...),
    language: str = Form("auto"),
):
    """
    Transcribe consultation audio using the full dual-path ASR pipeline.
    Used by the React OPD AudioRecorder in 'GPU ASR' mode.
    Returns: transcript, detected_language, confidence.
    """
    if model is None or whisper_model is None:
        raise HTTPException(status_code=503, detail="Models are still loading...")

    try:
        audio_bytes = await audio_file.read()
        waveform = preprocess_audio(audio_bytes)
        audio_tensor = waveform.unsqueeze(0)
    except Exception as e:
        logger.error(f"Audio preprocessing failed: {e}")
        raise HTTPException(status_code=400, detail=f"Could not process audio file: {e}")

    # --- Whisper LID ---
    whisper_audio = audio_tensor.to(device, dtype=torch.float16)
    input_features = whisper_processor(
        whisper_audio.cpu().numpy(), sampling_rate=16000, return_tensors="pt"
    ).input_features.to(device, dtype=torch.float16)

    decoder_input_ids = torch.tensor([[whisper_model.config.decoder_start_token_id]]).to(device)
    with torch.no_grad():
        logits = whisper_model(input_features, decoder_input_ids=decoder_input_ids).logits[:, 0, :]

    WHISPER_LANG_TOKENS = [
        "<|en|>", "<|hi|>", "<|kn|>", "<|mr|>", "<|ta|>", "<|te|>",
        "<|bn|>", "<|ml|>", "<|gu|>", "<|pa|>", "<|or|>"
    ]
    token_ids = []
    valid_tokens = []
    for token in WHISPER_LANG_TOKENS:
        tid = whisper_processor.tokenizer.convert_tokens_to_ids(token)
        if tid is not None:
            token_ids.append(tid)
            valid_tokens.append(token)

    target_logits = logits[0, token_ids]
    best_idx = torch.argmax(target_logits).item()
    best_token = valid_tokens[best_idx]
    raw_lang = best_token.replace("<|", "").replace("|>", "")
    supported_codes = ["en", "hi", "kn", "mr", "ta", "te", "bn", "ml", "gu", "pa", "or"]

    # If language is specified (not auto), use it; otherwise use detected
    if language != "auto" and language in supported_codes:
        lid_lang = language
    else:
        lid_lang = raw_lang if raw_lang in supported_codes else "hi"

    # --- Dual-path transcription ---
    # Path A: Whisper English
    whisper_transcript = ""
    try:
        forced_decoder_ids = whisper_processor.get_decoder_prompt_ids(language="english", task="transcribe")
        with torch.no_grad():
            predicted_ids = whisper_model.generate(input_features, forced_decoder_ids=forced_decoder_ids)
        whisper_transcript = whisper_processor.batch_decode(predicted_ids, skip_special_tokens=True)[0].strip()
    except Exception as e:
        logger.error(f"Whisper English transcription failed: {e}")

    # Path B: Conformer Indic
    conformer_lang = lid_lang if lid_lang != "en" else "hi"
    conformer_transcript = ""
    try:
        transcription = model(audio_tensor.to(device), conformer_lang, "rnnt")
        conformer_transcript = str(transcription).strip()
    except Exception as e:
        logger.error(f"Conformer transcription failed for {conformer_lang}: {e}")

    # Choose best transcript based on language
    if lid_lang == "en":
        final_transcript = whisper_transcript or conformer_transcript
    else:
        final_transcript = conformer_transcript or whisper_transcript

    logger.info(f"Consultation transcription: lang={lid_lang}, len={len(final_transcript)}")

    return JSONResponse(content={
        "success": True,
        "transcription": final_transcript,
        "detected_language": lid_lang,
        "detected_language_name": LANG_NAMES.get(lid_lang, lid_lang),
        "whisper_transcript": whisper_transcript,
        "conformer_transcript": conformer_transcript,
        "confidence": 1.0 if final_transcript else 0.0
    })


# ----------------------------------------------------------------
# Serve Frontend Static Files (must be LAST so API routes take priority)
# ----------------------------------------------------------------
import pathlib
_frontend_dir = pathlib.Path(__file__).resolve().parent.parent / "frontend"
if _frontend_dir.exists():
    from starlette.responses import HTMLResponse

    @app.get("/")
    async def serve_index():
        return HTMLResponse((_frontend_dir / "index.html").read_text(encoding="utf-8"))

    app.mount("/", StaticFiles(directory=str(_frontend_dir)), name="frontend")
