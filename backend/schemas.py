from pydantic import BaseModel, ConfigDict
from datetime import datetime, date, time
from typing import List, Optional

# --- Predefined Questions ---
class QuestionCreate(BaseModel):
    text_english: str
    category: str

class QuestionResponse(QuestionCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)

# --- Medications ---
class MedicationCreate(BaseModel):
    patient_id: int
    med_name: str
    dosage: str
    start_date: date
    end_date: date
    schedule_morning: bool = False
    schedule_afternoon: bool = False
    schedule_night: bool = False
    time_morning: Optional[time] = None
    time_afternoon: Optional[time] = None
    time_night: Optional[time] = None

class MedicationResponse(MedicationCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)

# --- Appointments ---
class AppointmentCreate(BaseModel):
    patient_id: int
    doctor_name: str
    date: datetime
    notes: Optional[str] = None

class AppointmentResponse(AppointmentCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)

# --- Patients ---
class PatientCreate(BaseModel):
    name: str
    age: int
    phone: str
    gender: str
    language: str
    doctor_name: str

class PatientResponse(PatientCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)

class PatientDetailResponse(PatientResponse):
    appointments: List[AppointmentResponse] = []
    medications: List[MedicationResponse] = []
    model_config = ConfigDict(from_attributes=True)

# --- Sessions & Responses ---
class SessionCreate(BaseModel):
    patient_id: int

class SessionResponse(SessionCreate):
    id: int
    start_time: datetime
    status: str
    model_config = ConfigDict(from_attributes=True)

class VoiceResponseCreate(BaseModel):
    session_id: int
    assistant_question: str
    patient_transcript: str
    detected_language: str
    intent: str

class VoiceResponse(VoiceResponseCreate):
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class SessionHistoryResponse(SessionResponse):
    responses: List[VoiceResponse] = []
    model_config = ConfigDict(from_attributes=True)
