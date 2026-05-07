-- VocabOPD Database Schema
-- Run this in PostgreSQL to create the tables

-- Create doctors table for authentication
CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hospital VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    specialty VARCHAR(100),
    phone VARCHAR(20),
    profile_picture TEXT,
    experience VARCHAR(50),
    location VARCHAR(100),
    license VARCHAR(100),
    education VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create consultations table
CREATE TABLE IF NOT EXISTS consultations (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER REFERENCES doctors(id),
    patient VARCHAR(255) NOT NULL,
    age VARCHAR(10),
    gender VARCHAR(20),
    symptoms TEXT,
    medical_history TEXT,
    transcript TEXT,
    language VARCHAR(50) DEFAULT 'english',
    consultation_date TIMESTAMP,
    consultation_time VARCHAR(20),
    diagnosis TEXT,
    prescription TEXT,
    advice TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_doctors_email ON doctors(email);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at DESC);

-- Display table structures
\d doctors;
\d consultations;

-- Show success message
SELECT 'Tables created successfully!' AS message;
SELECT 'Doctors table: ' || COUNT(*) || ' records' AS doctors_count FROM doctors;
SELECT 'Consultations table: ' || COUNT(*) || ' records' AS consultations_count FROM consultations; 
