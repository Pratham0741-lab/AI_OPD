# VocabOPD — AI-Powered Multilingual OPD Management System

An intelligent outpatient department (OPD) management system featuring **voice-powered consultations**, **AI-generated medical reports**, **multilingual speech recognition**, and an **automated Twilio-powered Call Scheduler** for medication adherence and health tracking.

---

## 🌟 Key Features

- **Voice-Powered Consultations** — Record doctor-patient conversations with real-time speech-to-text.
- **AI Medical Reports** — Auto-generate structured reports (diagnosis, prescription, advice) from consultation transcripts using OpenAI GPT models or Sarvam AI.
- **Multilingual ASR** — GPU-accelerated speech recognition in 11 Indian languages utilizing IndicConformer and Whisper.
- **Automated Health-Check Calls** — Fully integrated with Twilio to automatically call patients and ask health questions (e.g., "Did you take your medicine?").
- **Smart Call Scheduler** — Schedule patient phone calls (to the minute) for one-time, daily, or weekly recurrences, directly from the doctor's dashboard.
- **Live AI Voice Interaction** — Uses real-time Intent Detection during the call (Yes/No/Unclear) to intelligently register patient answers and log them to the backend dashboard.
- **TTS (Text-to-Speech)** — Multilingual spoken confirmations provided to the patient via Google TTS/Sarvam during the Twilio phone call.
- **Patient Management & Dashboard** — Register patients, manage history, view upcoming schedules, and generate downloadable digital PDF prescriptions.
- **Dual Database Architecture** — Runs flawlessly offline with local SQLite or integrates horizontally with PostgreSQL for production.

---

## 🛠 Tech Stack

| Layer                         | Technology / Tool                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| **Frontend UI**               | React 19, React Router, Axios, standard HTML5 Contextual Forms, CSS Modules                     |
| **Core API Backend**          | Node.js 20, Express.js, JWT, bcrypt (Auth, Consultation History, AI Reporting)                  |
| **AI Voice & Telephony API**  | Python 3.10+, FastAPI, Uvicorn, SQLModel / SQLAlchemy                                           |
| **Telephony Provider**        | Twilio REST API API (Outbound Calling, TwiML, Recording hooks)                                  |
| **Speech-to-Text (ASR)**      | IndicConformer-600M (Indic), Whisper-Small (EN/LID), Web Speech API (Browser Fallback)          |
| **Text-to-Speech (TTS)**      | gTTS (Google Text-to-Speech), natively streams to Twilio audio hooks                            |
| **LLM & Reasoning**           | OpenAI GPT-4o-mini / GPT-4 for Consultation Report Generation                                   |
| **Task Scheduling**           | Python native threading (daemon background loops checking due statuses every 30s)               |
| **Database**                  | SQLite3 (Default local), Postgres (Configurable)                                                |
| **Tunneling**                 | Ngrok (Exposing local audio/TwiML endpoints to Twilio webhooks)                                 |

---

## 🧩 System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (:3000)                   │
│   Dashboard │ Consultations │ Reports │ Schedule Calling    │
└──────────────────┬───────────────────────┬──────────────────┘
                   │                       │
         ┌─────────▼─────────┐   ┌─────────▼──────────────┐
         │  Node.js Backend  │   │     Python Fast API    │
         │  Express (:5000)  │   │   AI Telephony (:8000) │
         │                   │   │                        │
         │  • JWT Auth       │   │  • Twilio Scheduler    │
         │  • Consultations  │   │  • Twilio Webhooks     │
         │  • AI Reports     │   │  • Whisper/Conformer   │
         │  • Patient DB     │   │  • TTS & Intent Match  │
         └────────┬──────────┘   └─────────┬──────────────┘
                  │                        │                  ┌─────────────────┐
         ┌────────▼──────────┐             └─────────────────►│   Ngrok Tunnel  │
         │  SQLite Database  │◄───────────────────────────────┤ (Public Domain) │
         │  (vocabopd.db)    │                                └────────┬────────┘
         └───────────────────┘                                         │
                                                                   [Twilio]
```

---

## 🚀 Prerequisites

1. **Node.js** (`v18+`)
2. **Python** (`3.10+`)
3. **NVIDIA GPU** (`6GB+ VRAM`) — *Optional but highly recommended for GPU Accelerated Speech Recognition. System falls back to API components cleanly if CUDA is not available.*
4. **Twilio Account** (Account SID, Auth Token, Twilio Phone Number)
5. **Ngrok Account** (For local development webhook tunneling)
6. **OpenAI API Key** (For medical report generation)

---

## 📦 Setup & Installation Instructions

### Step 1: Clone the repository
```bash
git clone <repository_url>
cd VA
```

### Step 2: Set up the Node.js Backend API
This server handles authentication and medical records.
```bash
cd ai_opd_system_react_main/backend
npm install
```
Configure your Node `.env`:
```env
JWT_SECRET=your_secret_key_here
OPENAI_API_KEY=sk-your_openai_api_key
```

### Step 3: Set up the React Frontend
```bash
cd ../frontend
npm install
```

### Step 4: Set up the Python Voice Assistant (Telephony) Backend
This executes the scheduled automated calls and holds the ASR models.
```bash
cd d:\PROJECTS\VA
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```
*(If you have a GPU, ensure you install torch with CUDA support: `pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121`)*

Configure your Python `.env` in `d:\PROJECTS\VA\.env`:
```env
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# This must be your active Ngrok URL! Twilio uses this to contact your callbacks.
NGROK_URL=https://your-ngrok-url.ngrok-free.app
```

---

## 🏃‍♂️ Running the Application

To run the entire system, you will need **4 terminal windows**:

### Terminal 1: Ngrok Tunnel
Twilio requires a public URL to communicate with your localhost python server.
```bash
ngrok http 8000
```
*(Copy the resulting `https://...ngrok-free.app` URL and update `NGROK_URL` in `d:\PROJECTS\VA\.env`)*

### Terminal 2: Python Telephony Backend
```bash
cd d:\PROJECTS\VA
venv\Scripts\activate
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
*Note: The call background scheduler will initialize automatically on boot.*

### Terminal 3: Node.js Data Backend
```bash
cd d:\PROJECTS\VA\ai_opd_system_react_main\backend
node server.js
```

### Terminal 4: React Frontend
```bash
cd d:\PROJECTS\VA\ai_opd_system_react_main\frontend
npm start
```

Your system is now live at **http://localhost:3000**!

---

## 🩺 Usage Guide

### 1. In-Person Patient Consultations
- Navigate to **"Start New Consultation"**.
- Record clinical conversations. 
- Use the **Browser Microphone Fallback** or the robust **GPU Whispers/Conformer** backend for high accuracy in Hindi/Regional languages.
- Save the consultation.

### 2. Auto-Generating Prescriptions
- Head to **"Reports"**. Select a recent consultation.
- Click **"Generate AI Report"** to structure the messy spoken transcript into actionable points: Diagnosis, Findings, and Advice.

### 3. Automated Voice Assistant & Scheduler
- Head to **"Voice Assistant / Phone Call"**.
- Start a **"Call Now"** or enter the **"Schedule"** tab.
- Pick a patient, assign a phone number, select a health check question *(e.g. "Have you experienced any side effects?")*, and pick a **Date and Time**.
- Provide a `recurrence` pattern (Once, Daily, Weekly) and an optional `End Date`.
- Hit Schedule. The Python backend loop constantly checks pending tasks. When the exact minute arrives, it will trigger Twilio. Twilio plays TTS over the phone, records the patience's voice response, and the Python backend transcribes it back into the dashboard!

---

## Troubleshooting

- **Twilio Application Error:** Ensure `NGROK_URL` exactly matches the running ngrok instance in your `.env`. Verify your python server runs on port `8000`.
- **Background Scheduler Not Running:** The scheduler starts on app boot. Ensure `backend/main.py` finishes its startup cycle.
- **CUDA NOT Available:** The system will fallback safely. ASR locally via model weights will be disabled, but Twilio telephony and the API routes will continue to function properly.

---

*This project is built to enhance Doctor-Patient workflows by significantly reducing clinical documentation loads and ensuring medication adherence via robust automated infrastructure.*
