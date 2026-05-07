-- Fix consultations table structure
-- Add missing columns to match the expected schema

-- Add doctor_id column (foreign key to doctors table)
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES doctors(id);

-- Add medical_history column
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS medical_history TEXT;

-- Add language column
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'english';

-- Add consultation_date column
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS consultation_date TIMESTAMP;

-- Add consultation_time column
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS consultation_time VARCHAR(20);

-- Add diagnosis column
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS diagnosis TEXT;

-- Add prescription column
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS prescription TEXT;

-- Add advice column
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS advice TEXT;

-- Add updated_at column
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update age column to be VARCHAR instead of INTEGER (to handle values like "35 years")
ALTER TABLE consultations ALTER COLUMN age TYPE VARCHAR(10);

-- Display the updated table structure
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'consultations' 
ORDER BY ordinal_position;

-- Show success message
SELECT 'Consultations table updated successfully!' AS message;