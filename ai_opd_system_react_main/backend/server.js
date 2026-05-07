// Load environment variables
require('dotenv').config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pool = require("./db");
const authenticateToken = require("./middleware/authMiddleware");
const { generateMedicalReport, extractMedicalEntities } = require("./services/aiReportService");
const { translateText, translateConsultation, detectLanguage } = require("./services/translationService");
const { generatePrescriptionPDF } = require("./services/prescriptionService");
const { transcribeAudio } = require("./services/asrService");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "vocabopd_secret_key_2026";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  }
});

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all localhost and 127.0.0.1 origins on any port
    if (origin.startsWith('http://localhost:') || 
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('https://localhost:') || 
        origin.startsWith('https://127.0.0.1:')) {
      return callback(null, true);
    }
    
    // Log rejected origins for debugging
    console.log(`⚠ CORS rejected origin: ${origin}`);
    
    // Allow the request anyway (for development)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded files

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✓ Database connected successfully');
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "VocabOPD Backend API",
    version: "1.0.0",
    database: "PostgreSQL",
    authentication: "JWT",
    endpoints: {
      register: "POST /api/register",
      login: "POST /api/login",
      saveConsultation: "POST /api/consultation",
      getConsultations: "GET /api/history",
      getConsultationById: "GET /api/consultation/:id",
      generateReport: "GET /api/report/:id",
      getAllReports: "GET /api/reports"
    }
  });
});

// Test AI endpoint without authentication
app.post("/api/test-ai", async (req, res) => {
  try {
    const { transcript, patientInfo } = req.body;
    
    console.log(`✓ Test AI endpoint called`);
    console.log(`Transcript: ${transcript?.substring(0, 50)}...`);
    
    const report = await generateMedicalReport(transcript || "Test transcript", patientInfo || {});
    
    res.json({
      success: true,
      report,
      message: "Test AI report generated successfully"
    });
  } catch (error) {
    console.error("Test AI Error:", error);
    res.status(500).json({
      success: false,
      message: "Test AI failed",
      error: error.message
    });
  }
});

/* ============================================ */
/*           AUTHENTICATION ROUTES             */
/* ============================================ */

/* REGISTER NEW DOCTOR */
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, hospital, password } = req.body;
    
    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required"
      });
    }
    
    // Check if doctor already exists
    const existingDoctor = await pool.query(
      'SELECT * FROM doctors WHERE email = $1',
      [email]
    );
    
    if (existingDoctor.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Doctor with this email already exists"
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert new doctor
    const result = await pool.query(
      `INSERT INTO doctors (name, email, hospital, password)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, hospital, created_at`,
      [name, email, hospital || '', hashedPassword]
    );
    
    const doctor = result.rows[0];
    
    console.log(`✓ New doctor registered: ${doctor.name} (${doctor.email})`);
    
    res.json({
      success: true,
      message: "Registration successful",
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        hospital: doctor.hospital
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message
    });
  }
});

/* LOGIN DOCTOR */
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }
    
    // Find doctor by email
    const result = await pool.query(
      'SELECT * FROM doctors WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }
    
    const doctor = result.rows[0];
    
    // Verify password
    const validPassword = await bcrypt.compare(password, doctor.password);
    
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: doctor.id, 
        email: doctor.email,
        name: doctor.name
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    
    console.log(`✓ Doctor logged in: ${doctor.name} (${doctor.email})`);
    
    res.json({
      success: true,
      message: "Login successful",
      token,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        hospital: doctor.hospital
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message
    });
  }
});

/* CHANGE PASSWORD */
app.post("/api/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const doctorId = req.doctor.id;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters"
      });
    }
    
    // Get doctor's current password
    const result = await pool.query(
      'SELECT password FROM doctors WHERE id = $1',
      [doctorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found"
      });
    }
    
    const doctor = result.rows[0];
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, doctor.password);
    
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await pool.query(
      'UPDATE doctors SET password = $1 WHERE id = $2',
      [hashedPassword, doctorId]
    );
    
    console.log(`✓ Password changed for doctor ID: ${doctorId}`);
    
    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: error.message
    });
  }
});

/* UPDATE DOCTOR PROFILE */
app.put("/api/profile", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const { name, hospital, specialty, phone, location, license, experience, education } = req.body;
    
    // Update doctor profile with all fields and updated_at timestamp
    const result = await pool.query(
      `UPDATE doctors 
       SET name = $1, hospital = $2, specialty = $3, phone = $4, 
           location = $5, license = $6, experience = $7, education = $8, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING id, name, email, hospital, specialty, phone, location, license, experience, education, profile_picture, created_at, updated_at`,
      [
        name, 
        hospital || null, 
        specialty || null, 
        phone || null, 
        location || null, 
        license || null, 
        experience || null, 
        education || null, 
        doctorId
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found"
      });
    }
    
    const updatedDoctor = result.rows[0];
    
    console.log(`✓ Profile updated for doctor: ${updatedDoctor.name}`);
    
    res.json({
      success: true,
      message: "Profile updated successfully",
      doctor: {
        id: updatedDoctor.id,
        name: updatedDoctor.name,
        email: updatedDoctor.email,
        hospital: updatedDoctor.hospital,
        specialty: updatedDoctor.specialty,
        phone: updatedDoctor.phone,
        location: updatedDoctor.location,
        license: updatedDoctor.license,
        experience: updatedDoctor.experience,
        education: updatedDoctor.education,
        profilePicture: updatedDoctor.profile_picture
      }
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message
    });
  }
});

/* GET DOCTOR PROFILE */
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    
    const result = await pool.query(
      'SELECT id, name, email, hospital, specialty, phone, location, license, experience, education, profile_picture FROM doctors WHERE id = $1',
      [doctorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found"
      });
    }
    
    const doctor = result.rows[0];
    
    res.json({
      success: true,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        hospital: doctor.hospital,
        specialty: doctor.specialty,
        phone: doctor.phone,
        location: doctor.location,
        license: doctor.license,
        experience: doctor.experience,
        education: doctor.education,
        profilePicture: doctor.profile_picture,
        createdAt: doctor.created_at
      }
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get profile",
      error: error.message
    });
  }
});

/* ============================================ */
/*           CONSULTATION ROUTES               */
/* ============================================ */

/* SAVE CONSULTATION */
app.post("/api/consultation", authenticateToken, async (req, res) => {
  try {
    const { patient, age, gender, symptoms, medicalHistory, transcript, language, date, time, diagnosis, prescription, advice } = req.body;
    const doctorId = req.doctor.id;
    
    const result = await pool.query(
      `INSERT INTO consultations 
       (doctor_id, patient, age, gender, symptoms, medical_history, transcript, language, consultation_date, consultation_time, diagnosis, prescription, advice)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [doctorId, patient, age, gender, symptoms, medicalHistory || '', transcript || '', language || 'english', date, time, diagnosis || '', prescription || '', advice || '']
    );
    
    const consultation = result.rows[0];
    
    console.log(`✓ Consultation saved to database for patient: ${patient} (Doctor ID: ${doctorId})`);
    
    res.json({
      success: true,
      message: "Consultation saved successfully",
      data: {
        id: consultation.id.toString(),
        patient: consultation.patient,
        age: consultation.age,
        gender: consultation.gender,
        symptoms: consultation.symptoms,
        medicalHistory: consultation.medical_history,
        transcript: consultation.transcript,
        language: consultation.language,
        date: consultation.consultation_date,
        time: consultation.consultation_time,
        diagnosis: consultation.diagnosis,
        prescription: consultation.prescription,
        advice: consultation.advice,
        createdAt: consultation.created_at
      }
    });
  } catch (error) {
    console.error("Error saving consultation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save consultation",
      error: error.message
    });
  }
});

/* GET ALL CONSULTATIONS */
app.get("/api/history", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    
    const result = await pool.query(
      'SELECT * FROM consultations WHERE doctor_id = $1 ORDER BY created_at DESC',
      [doctorId]
    );
    
    const consultations = result.rows.map(row => ({
      id: row.id.toString(),
      patient: row.patient,
      age: row.age,
      gender: row.gender,
      symptoms: row.symptoms,
      medicalHistory: row.medical_history,
      transcript: row.transcript,
      language: row.language,
      date: row.consultation_date,
      time: row.consultation_time,
      createdAt: row.created_at
    }));
    
    console.log(`✓ Fetching ${consultations.length} consultations for doctor ID: ${doctorId}`);
    res.json(consultations);
  } catch (error) {
    console.error("Error fetching consultations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch consultations",
      error: error.message
    });
  }
});

/* GET CONSULTATION BY ID */
app.get("/api/consultation/:id", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    
    const result = await pool.query(
      'SELECT * FROM consultations WHERE id = $1 AND doctor_id = $2',
      [req.params.id, doctorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found or access denied"
      });
    }
    
    const row = result.rows[0];
    const consultation = {
      id: row.id.toString(),
      patient: row.patient,
      age: row.age,
      gender: row.gender,
      symptoms: row.symptoms,
      medicalHistory: row.medical_history,
      transcript: row.transcript,
      language: row.language,
      date: row.consultation_date,
      time: row.consultation_time,
      createdAt: row.created_at
    };
    
    res.json(consultation);
  } catch (error) {
    console.error("Error fetching consultation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch consultation",
      error: error.message
    });
  }
});

/* GENERATE MEDICAL REPORT */
app.get("/api/report/:id", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    
    const result = await pool.query(
      'SELECT * FROM consultations WHERE id = $1 AND doctor_id = $2',
      [req.params.id, doctorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found"
      });
    }
    
    const consultation = result.rows[0];
    
    // Generate report from consultation data
    const report = {
      reportId: "REP-" + consultation.id,
      consultationId: consultation.id.toString(),
      patient: consultation.patient,
      age: consultation.age,
      gender: consultation.gender,
      symptoms: consultation.symptoms,
      medicalHistory: consultation.medical_history || "None",
      transcript: consultation.transcript,
      language: consultation.language,
      diagnosis: consultation.diagnosis || "Pending Doctor Review",
      prescription: consultation.prescription || "To be prescribed by doctor",
      advice: consultation.advice || "Follow up if symptoms persist",
      date: consultation.consultation_date,
      time: consultation.consultation_time,
      createdAt: consultation.created_at
    };
    
    console.log(`✓ Report generated for patient: ${consultation.patient}`);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({
      success: false,
      message: "Report generation failed",
      error: error.message
    });
  }
});

/* GET ALL REPORTS */
app.get("/api/reports", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    
    const result = await pool.query(
      'SELECT * FROM consultations WHERE doctor_id = $1 ORDER BY created_at DESC',
      [doctorId]
    );
    
    // Generate reports for all consultations
    const reports = result.rows.map(consultation => {
      const hasValidDiagnosis = consultation.diagnosis && 
                                consultation.diagnosis !== "Pending Review" && 
                                consultation.diagnosis !== "Not provided" &&
                                consultation.diagnosis.trim() !== "";
      
      const hasValidPrescription = consultation.prescription && 
                                   consultation.prescription !== "Not prescribed" &&
                                   consultation.prescription !== "To be prescribed by doctor" &&
                                   consultation.prescription.trim() !== "";
      
      return {
        reportId: "REP-" + consultation.id,
        consultationId: consultation.id.toString(),
        patient: consultation.patient,
        age: consultation.age,
        gender: consultation.gender,
        symptoms: consultation.symptoms,
        diagnosis: consultation.diagnosis || "Pending Review",
        prescription: consultation.prescription || "To be prescribed by doctor",
        advice: consultation.advice || "Follow up if symptoms persist",
        date: consultation.consultation_date,
        time: consultation.consultation_time,
        status: hasValidDiagnosis ? "completed" : "pending",
        aiGenerated: hasValidDiagnosis && hasValidPrescription,
        language: consultation.language || "english",
        createdAt: consultation.created_at
      };
    });
    
    console.log(`✓ Fetching ${reports.length} reports for doctor ID: ${doctorId}`);
    res.json(reports);
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports",
      error: error.message
    });
  }
});

/* ============================================ */
/*           TRANSLATION ROUTES                */
/* ============================================ */

/* TRANSLATE TEXT */
app.post("/api/translate", authenticateToken, async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    
    if (!text || !targetLanguage) {
      return res.status(400).json({
        success: false,
        message: "Text and target language are required"
      });
    }
    
    const result = await translateText(text, targetLanguage);
    
    console.log(`✓ Translated text to ${targetLanguage}`);
    
    res.json(result);
  } catch (error) {
    console.error("Translation error:", error);
    res.status(500).json({
      success: false,
      message: "Translation failed",
      error: error.message
    });
  }
});

/* TRANSLATE CONSULTATION */
app.post("/api/translate-consultation", authenticateToken, async (req, res) => {
  try {
    const { consultation, targetLanguage } = req.body;
    
    if (!consultation || !targetLanguage) {
      return res.status(400).json({
        success: false,
        message: "Consultation data and target language are required"
      });
    }
    
    const result = await translateConsultation(consultation, targetLanguage);
    
    console.log(`✓ Translated consultation to ${targetLanguage}`);
    
    res.json(result);
  } catch (error) {
    console.error("Consultation translation error:", error);
    res.status(500).json({
      success: false,
      message: "Consultation translation failed",
      error: error.message
    });
  }
});

/* DETECT LANGUAGE */
app.post("/api/detect-language", authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Text is required"
      });
    }
    
    const result = await detectLanguage(text);
    
    res.json(result);
  } catch (error) {
    console.error("Language detection error:", error);
    res.status(500).json({
      success: false,
      message: "Language detection failed",
      error: error.message
    });
  }
});

/* ============================================ */
/*           AI REPORT GENERATION              */
/* ============================================ */

/* GENERATE AI MEDICAL REPORT */
app.post("/api/ai-report", authenticateToken, async (req, res) => {
  try {
    console.log(`✓ AI Report endpoint called by user: ${req.doctor?.name || 'Unknown'}`);
    
    const { transcript, patientInfo } = req.body;
    
    if (!transcript) {
      console.log(`✗ No transcript provided`);
      return res.status(400).json({
        success: false,
        message: "Transcript is required"
      });
    }
    
    console.log(`✓ Generating AI report for patient: ${patientInfo?.patient || 'Unknown'}`);
    console.log(`✓ Transcript length: ${transcript.length} characters`);
    
    // Generate comprehensive medical report
    const report = await generateMedicalReport(transcript, patientInfo || {});
    
    console.log(`✓ AI report generated successfully (${report.length} characters)`);
    
    // Extract structured medical entities
    const entities = await extractMedicalEntities(transcript);
    
    res.json({
      success: true,
      report,
      entities,
      message: "AI report generated successfully"
    });
  } catch (error) {
    console.error("AI Report Generation Error:", error.message);
    console.error("Stack trace:", error.stack);
    res.status(500).json({
      success: false,
      message: "AI report generation failed",
      error: error.message
    });
  }
});

/* UPDATE CONSULTATION WITH AI REPORT */
app.put("/api/consultation/:id/ai-report", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosis, prescription, advice } = req.body;
    
    const result = await pool.query(
      `UPDATE consultations 
       SET diagnosis = $1, prescription = $2, advice = $3
       WHERE id = $4
       RETURNING *`,
      [diagnosis, prescription, advice, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found"
      });
    }
    
    console.log(`✓ Consultation ${id} updated with AI report`);
    
    res.json({
      success: true,
      message: "Consultation updated with AI report",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating consultation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update consultation",
      error: error.message
    });
  }
});

/* ============================================ */
/*           ASR (WHISPER) TRANSCRIPTION       */
/* ============================================ */

console.log('✓ Registering ASR transcription endpoint...');

/* Configure multer for audio file uploads */
const audioStorage = multer.memoryStorage();
const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: function (req, file, cb) {
    const filetypes = /wav|mp3|webm|ogg|m4a/;
    const mimetype = filetypes.test(file.mimetype) || file.mimetype.includes('audio');
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype || extname) {
      return cb(null, true);
    }
    cb(new Error("Only audio files are allowed!"));
  }
});

console.log('✓ Audio upload middleware configured');

/* TRANSCRIBE AUDIO WITH WHISPER ASR */
app.post("/api/transcribe", authenticateToken, audioUpload.single('audio'), async (req, res) => {
  try {
    console.log(`✓ Transcribe endpoint called by user: ${req.doctor?.name || 'Unknown'}`);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No audio file provided"
      });
    }
    
    const { language } = req.body;
    const audioBuffer = req.file.buffer;
    const filename = req.file.originalname || 'audio.wav';
    
    console.log(`✓ Received audio file: ${filename}`);
    console.log(`✓ Size: ${audioBuffer.length} bytes`);
    console.log(`✓ Language: ${language || 'kannada'}`);
    
    // Transcribe using Whisper ASR
    const result = await transcribeAudio(audioBuffer, filename, language || 'kannada');
    
    console.log(`✓ Transcription successful`);
    
    res.json({
      success: true,
      transcription: result.transcription,
      language: result.language,
      duration: result.duration,
      confidence: result.confidence
    });
    
  } catch (error) {
    console.error("Transcription Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Audio transcription failed",
      error: error.message
    });
  }
});

console.log('✓ ASR transcription endpoint registered successfully');

/* ============================================ */
/*           NOTIFICATION ROUTES               */
/* ============================================ */

/* GET ALL NOTIFICATIONS FOR DOCTOR */
app.get("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    
    const result = await pool.query(
      'SELECT * FROM notifications WHERE doctor_id = $1 ORDER BY created_at DESC LIMIT 50',
      [doctorId]
    );
    
    const notifications = result.rows.map(row => ({
      id: row.id,
      message: row.message,
      time: row.created_at,
      unread: row.unread !== undefined ? row.unread : true
    }));
    
    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message
    });
  }
});

/* CREATE NOTIFICATION */
app.post("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Notification message is required"
      });
    }
    
    // Try with unread column first, fallback to without
    let result;
    try {
      result = await pool.query(
        'INSERT INTO notifications (doctor_id, message, unread) VALUES ($1, $2, true) RETURNING *',
        [doctorId, message]
      );
    } catch (err) {
      // If unread column doesn't exist, insert without it
      result = await pool.query(
        'INSERT INTO notifications (doctor_id, message) VALUES ($1, $2) RETURNING *',
        [doctorId, message]
      );
    }
    
    console.log(`✓ Notification created for doctor ID: ${doctorId}`);
    
    res.json({
      success: true,
      notification: {
        id: result.rows[0].id,
        message: result.rows[0].message,
        time: result.rows[0].created_at,
        unread: result.rows[0].unread !== undefined ? result.rows[0].unread : true
      }
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create notification",
      error: error.message
    });
  }
});

/* MARK NOTIFICATION AS READ */
app.put("/api/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.doctor.id;
    
    await pool.query(
      'UPDATE notifications SET unread = false WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );
    
    res.json({
      success: true,
      message: "Notification marked as read"
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message
    });
  }
});

/* MARK ALL NOTIFICATIONS AS READ */
app.put("/api/notifications/read-all", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    
    await pool.query(
      'UPDATE notifications SET unread = false WHERE doctor_id = $1',
      [doctorId]
    );
    
    console.log(`✓ All notifications marked as read for doctor ID: ${doctorId}`);
    
    res.json({
      success: true,
      message: "All notifications marked as read"
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message
    });
  }
});

/* DELETE NOTIFICATION */
app.delete("/api/notifications/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.doctor.id;
    
    await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );
    
    res.json({
      success: true,
      message: "Notification deleted"
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: error.message
    });
  }
});

/* ============================================ */
/*           PRESCRIPTION PDF GENERATION       */
/* ============================================ */

/* GENERATE PRESCRIPTION PDF */
app.get("/api/prescription/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get consultation data
    const result = await pool.query(
      'SELECT * FROM consultations WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Consultation not found"
      });
    }
    
    const consultationData = result.rows[0];
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=prescription_${consultationData.patient.replace(/\s/g, '_')}_${Date.now()}.pdf`
    );
    
    console.log(`✓ Generating prescription PDF for patient: ${consultationData.patient}`);
    
    // Generate PDF
    generatePrescriptionPDF(consultationData, res);
    
  } catch (error) {
    console.error("Prescription PDF generation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate prescription PDF",
      error: error.message
    });
  }
});

/* ============================================ */
/*           APPOINTMENTS ROUTES               */
/* ============================================ */

/* GET ALL APPOINTMENTS FOR DOCTOR */
app.get("/api/appointments", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    
    const result = await pool.query(
      `SELECT * FROM appointments 
       WHERE doctor_id = $1 
       ORDER BY appointment_date ASC, time ASC`,
      [doctorId]
    );
    
    const appointments = result.rows.map(row => ({
      id: row.id,
      patient: row.patient,
      time: row.time,
      type: row.type,
      date: row.appointment_date,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at
    }));
    
    console.log(`✓ Fetching ${appointments.length} appointments for doctor ID: ${doctorId}`);
    
    res.json(appointments);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
      error: error.message
    });
  }
});

/* CREATE NEW APPOINTMENT */
app.post("/api/appointments", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const { patient, time, type, date, notes } = req.body;
    
    if (!patient || !time) {
      return res.status(400).json({
        success: false,
        message: "Patient name and time are required"
      });
    }
    
    const result = await pool.query(
      `INSERT INTO appointments 
       (doctor_id, patient, time, type, appointment_date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        doctorId, 
        patient, 
        time, 
        type || 'Consultation', 
        date || new Date().toISOString().split('T')[0],
        'scheduled',
        notes || ''
      ]
    );
    
    const appointment = result.rows[0];
    
    console.log(`✓ Appointment created for patient: ${patient} (Doctor ID: ${doctorId})`);
    
    res.json({
      success: true,
      message: "Appointment created successfully",
      data: {
        id: appointment.id,
        patient: appointment.patient,
        time: appointment.time,
        type: appointment.type,
        date: appointment.appointment_date,
        status: appointment.status,
        notes: appointment.notes,
        createdAt: appointment.created_at
      }
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create appointment",
      error: error.message
    });
  }
});

/* UPDATE APPOINTMENT */
app.put("/api/appointments/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.doctor.id;
    const { patient, time, type, date, status, notes } = req.body;
    
    const result = await pool.query(
      `UPDATE appointments 
       SET patient = $1, time = $2, type = $3, appointment_date = $4, 
           status = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND doctor_id = $8
       RETURNING *`,
      [patient, time, type, date, status, notes, id, doctorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }
    
    console.log(`✓ Appointment ${id} updated`);
    
    res.json({
      success: true,
      message: "Appointment updated successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update appointment",
      error: error.message
    });
  }
});

/* DELETE APPOINTMENT */
app.delete("/api/appointments/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.doctor.id;
    
    const result = await pool.query(
      'DELETE FROM appointments WHERE id = $1 AND doctor_id = $2 RETURNING *',
      [id, doctorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }
    
    console.log(`✓ Appointment ${id} deleted`);
    
    res.json({
      success: true,
      message: "Appointment deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete appointment",
      error: error.message
    });
  }
});

/* ============================================ */
/*           NOTIFICATION ROUTES               */
/* ============================================ */

/* GET NOTIFICATIONS */
app.get("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const result = await pool.query(
      'SELECT * FROM notifications WHERE doctor_id = $1 ORDER BY created_at DESC LIMIT 50',
      [doctorId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ success: false, message: "Failed to fetch notifications", error: error.message });
  }
});

/* CREATE NOTIFICATION */
app.post("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const { message } = req.body;
    const result = await pool.query(
      'INSERT INTO notifications (doctor_id, message) VALUES ($1, $2) RETURNING *',
      [doctorId, message]
    );
    res.json({ success: true, notification: result.rows[0] });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ success: false, message: "Failed to create notification", error: error.message });
  }
});

/* MARK NOTIFICATION AS READ */
app.put("/api/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE notifications SET unread = 0 WHERE id = $1 AND doctor_id = $2 RETURNING *',
      [id, doctorId]
    );
    res.json({ success: true, notification: result.rows[0] });
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ success: false, message: "Failed to update notification", error: error.message });
  }
});

/* MARK ALL NOTIFICATIONS AS READ */
app.put("/api/notifications/read-all", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    await pool.query(
      'UPDATE notifications SET unread = 0 WHERE doctor_id = $1',
      [doctorId]
    );
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error updating notifications:", error);
    res.status(500).json({ success: false, message: "Failed to update notifications", error: error.message });
  }
});

/* DELETE NOTIFICATION */
app.delete("/api/notifications/:id", authenticateToken, async (req, res) => {
  try {
    const doctorId = req.doctor.id;
    const { id } = req.params;
    await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND doctor_id = $2',
      [id, doctorId]
    );
    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ success: false, message: "Failed to delete notification", error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  console.log(`⚠ 404 - Endpoint not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: "Endpoint not found"
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message
  });
});

// Start server
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║     VocabOPD Backend API Server           ║");
  console.log("╚════════════════════════════════════════════╝\n");
  console.log(`✓ Server running on ${HOST}:${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log("✓ Ready to accept requests!\n");
});