"""
Multilingual Assistive Voice AI - FastAPI Backend (GPU-Free)

Handles patient management, appointments, medications, interview sessions,
dashboard stats, and Twilio phone-based health-check calls.
All speech recognition is handled by Twilio's built-in ASR — no GPU required.
"""

import os
import logging
import datetime
import random

from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from backend.intent import classify_intent
import backend.models as models
import backend.schemas as schemas
from backend.database import SessionLocal, engine
from backend.twilio_calls import router as twilio_router, start_scheduler as start_call_scheduler
from backend.constants import (
    INITIAL_QUESTIONS_EN, INTENT_KEYWORDS,
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

# ----------------------------------------------------------------
# FastAPI Application
# ----------------------------------------------------------------
app = FastAPI(
    title="Multilingual Assistive Voice AI",
    version="3.0.0",
    description="GPU-free backend for VocabOPD. Twilio handles all speech recognition.",
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


@app.on_event("startup")
async def startup():
    """Start the call scheduler on server boot."""
    start_call_scheduler()
    logger.info("✅ Server started (GPU-free mode)")
    logger.info("✅ Call scheduler initialized")


# ----------------------------------------------------------------
# Health Check
# ----------------------------------------------------------------
@app.get("/api/va/health")
async def health_check():
    """Health check endpoint for frontend connectivity tests."""
    return JSONResponse(content={
        "status": "ok",
        "mode": "gpu-free",
        "models_loaded": False,
        "message": "Twilio handles all speech recognition. No GPU required.",
    })


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
