from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Date, Time
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database import Base

class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    age = Column(Integer)
    phone = Column(String)
    gender = Column(String)
    language = Column(String)
    doctor_name = Column(String)
    
    sessions = relationship("InterviewSession", back_populates="patient", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")
    medications = relationship("Medication", back_populates="patient", cascade="all, delete-orphan")

class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    doctor_name = Column(String)
    date = Column(DateTime)
    notes = Column(String)
    
    patient = relationship("Patient", back_populates="appointments")

class Medication(Base):
    __tablename__ = "medications"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    med_name = Column(String)
    dosage = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
    schedule_morning = Column(Boolean, default=False)
    schedule_afternoon = Column(Boolean, default=False)
    schedule_night = Column(Boolean, default=False)
    time_morning = Column(Time, nullable=True)
    time_afternoon = Column(Time, nullable=True)
    time_night = Column(Time, nullable=True)
    
    patient = relationship("Patient", back_populates="medications")

class InterviewSession(Base):
    __tablename__ = "sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    start_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="active")
    
    patient = relationship("Patient", back_populates="sessions")
    responses = relationship("InterviewResponse", back_populates="session", cascade="all, delete-orphan")

class InterviewResponse(Base):
    __tablename__ = "responses"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    assistant_question = Column(String)
    patient_transcript = Column(String)
    detected_language = Column(String)
    intent = Column(String)
    call_type = Column(String, default="browser")  # "browser" or "twilio"
    ai_response_text = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("InterviewSession", back_populates="responses")

class TwilioCallLog(Base):
    __tablename__ = "twilio_call_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    call_sid = Column(String, unique=True, nullable=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    phone_number = Column(String, nullable=False)
    question_text = Column(String)
    question_audio_filename = Column(String, nullable=True)
    status = Column(String, default="initiating")
    duration = Column(Integer, nullable=True)
    recording_url = Column(String, nullable=True)
    recording_sid = Column(String, nullable=True)
    transcript = Column(String, nullable=True)
    intent = Column(String, nullable=True)
    detected_language = Column(String, nullable=True)
    response_text = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    patient = relationship("Patient", backref="twilio_calls")

class ScheduledCall(Base):
    __tablename__ = "scheduled_calls"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    patient_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=False)
    question_id = Column(Integer, default=0)
    question_text = Column(String, nullable=True)
    scheduled_time = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)  # end date for recurring schedules
    status = Column(String, default="pending")  # pending, completed, failed, cancelled
    recurrence = Column(String, default="once")  # once, daily, weekly, custom
    weekdays = Column(String, nullable=True)  # comma-separated: "mon,wed,fri"
    language = Column(String, default="en")  # patient's language for ASR + response
    call_log_id = Column(Integer, nullable=True)  # links to TwilioCallLog after execution
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    patient = relationship("Patient", backref="scheduled_calls")

class PredefinedQuestion(Base):
    __tablename__ = "predefined_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    text_english = Column(String)
    category = Column(String)
