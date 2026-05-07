# VocabOPD — AI-Powered Multilingual OPD Management System

An intelligent outpatient department (OPD) management system with **voice-powered consultations**, **AI-generated medical reports**, **multilingual speech recognition** (11 Indian languages), and **medication adherence tracking** via a voice assistant.

---

## Features

- **Voice-Powered Consultations** — Record doctor-patient conversations with real-time speech-to-text
- **AI Medical Reports** — Auto-generate structured reports (diagnosis, prescription, advice) from consultation transcripts using GPT-4o / Sarvam AI
- **Multilingual ASR** — GPU-accelerated speech recognition in 11 Indian languages (English, Hindi, Kannada, Tamil, Telugu, Marathi, Bengali, Malayalam, Gujarati, Punjabi, Odia) using IndicConformer + Whisper
- **Voice Assistant** — Automated medication adherence calls with language detection, intent classification, and TTS responses
- **Patient Management** — Register patients, track history, manage appointments
- **Digital Prescriptions** — Generate downloadable PDF prescriptions
- **Translation** — Translate consultations between supported languages
- **Doctor Dashboard** — Real-time stats, upcoming appointments, recent patients
- **JWT Authentication** — Secure login/registration system for doctors

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, React Router 7, Axios |
| **Backend (API)** | Node.js, Express 5, PostgreSQL, JWT, bcrypt |
| **Backend (Voice AI)** | Python, FastAPI, PyTorch (CUDA), IndicConformer-600M, Whisper-Small |
| **AI Reports** | OpenAI GPT-4o-mini / Sarvam AI |
| **ASR** | IndicConformer (Indic languages) + Whisper (English + LID) |
| **TTS** | gTTS (Google Text-to-Speech) |
| **Database** | SQLite (Local Mode) / PostgreSQL |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (:3000)                │
│  Dashboard │ Consultations │ Reports │ Voice Assistant   │
└──────────────────┬──────────────────┬───────────────────┘
                   │                  │
         ┌─────────▼─────────┐  ┌────▼──────────────────┐
         │  Node.js Backend  │  │  Python Voice AI       │
         │  Express (:5000)  │  │  FastAPI (:8000)       │
         │                   │  │                        │
         │  • Auth (JWT)     │  │  • IndicConformer ASR  │
         │  • Consultations  │  │  • Whisper LID         │
         │  • AI Reports     │  │  • Intent Detection    │
         │  • Appointments   │  │  • TTS Responses       │
         │  • Prescriptions  │  │  • Health Check Calls  │
         └────────┬──────────┘  └────────────────────────┘
                  │                      │
         ┌────────▼──────────┐    ┌──────▼───────┐
         │  SQLite / PG DB   │    │  CUDA GPU    │
         │   (vocabopd)      │    │  (Required)  │
         └───────────────────┘    └──────────────┘
```

---

## Prerequisites

Before you begin, make sure you have the following installed:

| Software | Version | Check Command |
|----------|---------|--------------|
| **Node.js** | v18+ | `node --version` |
| **npm** | v9+ | `npm --version` |
| **Python** | 3.10+ | `python --version` |
| **CUDA Toolkit** | 12.1+ | `nvcc --version` |
| **FFmpeg** | Any | `ffmpeg -version` |
| **NVIDIA GPU** | 6GB+ VRAM | `nvidia-smi` |

> **Note:** The Voice AI backend (Python/FastAPI) **requires a CUDA-capable NVIDIA GPU**. The OPD system (React + Node.js) works out-of-the-box using a local SQLite database and falls back to browser-based speech recognition if no GPU is present.

---

## Setup & Installation

### Step 1 — Clone & Navigate

```bash
cd d:\PROJECTS\VA
```

### Step 2 — Configure the Node.js Backend

1. Navigate to the backend:

```bash
cd ai_opd_system_react_main/backend
```

2. Install dependencies:

```bash
npm install
```

> **Note:** The backend is configured to automatically create an `SQLite` file database (`vocabopd.sqlite`) on first boot. No external database server is required!

### Step 3 — Install the React Frontend

```bash
cd ../frontend
npm install
```

### Step 4 — Set Up the Python Voice AI Backend (Optional — requires GPU)

> **Skip this step** if you don't have an NVIDIA GPU. The OPD system will still work with browser-based speech recognition.

1. Navigate to the Voice AI backend:

```bash
cd d:\PROJECTS\VA
```

2. Create a Python virtual environment:

```bash
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate  # macOS/Linux
```

3. Install dependencies:

```bash
pip install fastapi uvicorn python-multipart transformers gTTS soundfile numpy
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install onnx==1.20.1 onnxruntime-gpu==1.20.1
```

4. Verify CUDA and GPU:

```bash
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}, GPU: {torch.cuda.get_device_name(0)}')"
```

Expected output: `CUDA: True, GPU: NVIDIA GeForce RTX XXXX`

---

## Running the Application

You need **3 terminals** (2 required + 1 optional for GPU voice AI):

### Terminal 1 — Start the Node.js Backend

node server.js
```

Expected output:
```
╔════════════════════════════════════════════╗
║     VocabOPD Backend API Server           ║
║     with SQLite Database (Local Mode)     ║
╚════════════════════════════════════════════╝

✓ Successfully connected to SQLite database
✓ SQLite tables initialized.
✓ Server running on port 5000
✓ Ready to accept requests!
```

### Terminal 2 — Start the React Frontend

```bash
cd d:\PROJECTS\VA\ai_opd_system_react_main\frontend
npm start
```

The app opens automatically at **http://localhost:3000**

### Terminal 3 — Start the Voice AI Backend (Optional — GPU required)

```bash
cd d:\PROJECTS\VA
venv\Scripts\activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Expected output:
```
✅ CUDA device: NVIDIA GeForce RTX XXXX
Loading ai4bharat/indic-conformer-600m-multilingual...
✅ IndicConformer loaded and ready on GPU
Loading Whisper-Small (fp16)...
✅ Whisper-Small loaded and ready on GPU
```

> First run takes **3-5 minutes** to download the models (~1.5 GB total).

---

## Usage

### 1. Register & Login

1. Open **http://localhost:3000**
2. Click **Register** → Create a doctor account
3. Login with your credentials

### 2. Record a Consultation

1. Click **"Start New Consultation"** from the dashboard
2. Fill in patient details (name, age, gender)
3. Select the consultation language
4. Click the **microphone** button to record the conversation
5. Choose ASR mode:
   - **GPU ASR** — Best accuracy, 11 languages (requires Python backend on port 8000)
   - **Whisper ASR** — Backend-based transcription
   - **Browser** — Real-time browser speech recognition (no server needed)
6. Click **Save Consultation**

### 3. Generate AI Reports

1. Go to **Reports** page
2. Select a consultation
3. Click **Generate AI Report**
4. The AI analyzes the transcript and generates:
   - Chief complaints
   - Clinical findings
   - Diagnosis
   - Prescription
   - Medical advice

### 4. Voice Assistant (Medication Adherence)

1. Go to **Voice Assistant** page
2. The system asks a health-check question with TTS audio
3. Patient responds in any supported language
4. The AI detects language, transcribes, and classifies intent (Yes/No/Unclear)
5. A confirmation response is played back in the patient's language

### 5. Manage Appointments

- From the **Dashboard**, click **"Add"** to schedule new appointments
- Filter by Today, Tomorrow, Next 7 Days, or All
- Delete appointments as needed

---

## Available API Endpoints

### Node.js Backend (port 5000)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/register` | Register new doctor | No |
| `POST` | `/api/login` | Login | No |
| `GET` | `/api/profile` | Get doctor profile | JWT |
| `PUT` | `/api/profile` | Update profile | JWT |
| `POST` | `/api/consultation` | Save consultation | JWT |
| `GET` | `/api/history` | Get all consultations | JWT |
| `GET` | `/api/consultation/:id` | Get consultation by ID | JWT |
| `POST` | `/api/ai-report` | Generate AI medical report | JWT |
| `PUT` | `/api/consultation/:id/ai-report` | Update with AI report | JWT |
| `GET` | `/api/reports` | Get all reports | JWT |
| `POST` | `/api/transcribe` | Transcribe audio (Whisper) | JWT |
| `POST` | `/api/translate` | Translate text | JWT |
| `GET` | `/api/appointments` | Get appointments | JWT |
| `POST` | `/api/appointments` | Create appointment | JWT |
| `DELETE` | `/api/appointments/:id` | Delete appointment | JWT |
| `GET` | `/api/notifications` | Get notifications | JWT |

### Python Voice AI Backend (port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/va/health` | Health check + model status |
| `POST` | `/api/va/transcribe-consultation` | GPU ASR transcription |
| `POST` | `/api/va/health-check-call` | Full medication adherence call |
| `GET` | `/api/va/question-audio` | Get health-check question + TTS |
| `GET` | `/get-question-audio` | Get initial question + TTS |

---

## Project Structure

```
VA/
├── ai_opd_system_react_main/
│   ├── frontend/                  # React Frontend
│   │   ├── src/
│   │   │   ├── components/        # Reusable UI components
│   │   │   │   ├── AudioRecorder.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Navbar.jsx
│   │   │   ├── pages/             # Page components
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── RecordConsultation.jsx
│   │   │   │   ├── PatientHistory.jsx
│   │   │   │   ├── Reports.jsx
│   │   │   │   ├── Profile.jsx
│   │   │   │   ├── VoiceAssistant.jsx
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Register.jsx
│   │   │   ├── services/          # API service functions
│   │   │   │   ├── api.js
│   │   │   │   └── voiceAssistantService.js
│   │   │   ├── styles/            # CSS stylesheets
│   │   │   ├── utils/             # Utility functions
│   │   │   └── App.js             # Root component with routing
│   │   └── package.json
│   │
│   └── backend/                   # Node.js Express Backend
│       ├── server.js              # Main Express server (all routes)
│       ├── db.js                  # PostgreSQL connection
│       ├── middleware/
│       │   └── authMiddleware.js  # JWT authentication
│       ├── services/
│       │   ├── aiReportService.js # OpenAI / Sarvam AI report generation
│       │   ├── asrService.js      # Whisper ASR integration
│       │   ├── translationService.js
│       │   └── prescriptionService.js
│       ├── create_table.sql       # Database schema
│       ├── .env.example           # Environment variable template
│       └── package.json
│
├── backend/                       # Python FastAPI Voice AI Backend
│   ├── main.py                    # FastAPI server (GPU ASR + Voice Assistant)
│   ├── database.py                # SQLAlchemy database config
│   ├── models.py                  # SQLAlchemy ORM models
│   ├── schemas.py                 # Pydantic request/response schemas
│   └── intent.py                  # Intent classification logic
│
├── frontend/                      # Standalone HTML/JS frontend (legacy)
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── requirements.txt               # Python dependencies
└── README.md                      # This file
```

---

## ASR Modes Explained

The system provides 3 tiers of speech recognition, with automatic fallback:

```
GPU ASR (Best) → Backend Whisper → Browser Speech Recognition (Fallback)
```

| Mode | Engine | Languages | Accuracy | Requires |
|------|--------|-----------|----------|----------|
| **GPU ASR** | IndicConformer-600M + Whisper-Small | 11 Indian languages | ★★★★★ | NVIDIA GPU + Python backend |
| **Backend Whisper** | Whisper API (external) | Configurable | ★★★★☆ | External ASR endpoint |
| **Browser** | Web Speech API (Chrome/Edge) | Depends on browser | ★★★☆☆ | Nothing (built into browser) |

The AudioRecorder component **automatically detects** which modes are available and falls back gracefully.

---

## Environment Variables Reference

### Node.js Backend (`ai_opd_system_react_main/backend/.env`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DB_USER` | Yes | PostgreSQL username | `postgres` |
| `DB_HOST` | Yes | Database host | `localhost` |
| `DB_NAME` | Yes | Database name | `vocabopd` |
| `DB_PASSWORD` | Yes | Database password | `your_password` |
| `DB_PORT` | Yes | Database port | `5432` |
| `JWT_SECRET` | Yes | JWT signing key | `vocabopd_secret_key_2026` |
| `OPENAI_API_KEY` | For AI reports | OpenAI API key | `sk-...` |
| `OPENAI_BASE_URL` | Optional | Custom AI endpoint | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Optional | AI model name | `gpt-4o-mini` |
| `PORT` | Optional | Server port | `5000` |
| `NODE_ENV` | Optional | Environment | `development` |

---

## Troubleshooting

### Database connection failed
- If running locally with SQLite, check that `vocabopd.sqlite` has read/write permissions.
- Ensure you have run `npm install` to get the `sqlite3` driver.

### "CUDA is NOT available" error
- Install CUDA Toolkit 12.1+: https://developer.nvidia.com/cuda-downloads
- Install PyTorch with CUDA: `pip install torch --index-url https://download.pytorch.org/whl/cu121`
- Verify: `python -c "import torch; print(torch.cuda.is_available())"`

### Frontend won't start
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear npm cache: `npm cache clean --force`

### Models downloading slowly
- First run downloads ~1.5 GB of models (IndicConformer + Whisper)
- Models are cached in `~/.cache/huggingface/` after first download
- Subsequent starts are much faster (~30 seconds)

### FFmpeg not found
- Windows: Download from https://ffmpeg.org/download.html and add to PATH
- Linux: `sudo apt install ffmpeg`
- macOS: `brew install ffmpeg`

### AI Report generation fails
- Check that `OPENAI_API_KEY` is set correctly in `.env`
- Verify API key has credits: https://platform.openai.com/usage
- Check backend logs for specific error messages

---

## License

This project is for educational and research purposes.
