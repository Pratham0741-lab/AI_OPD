-- Update schema to add missing columns if they don't exist
-- Run this if you get errors about missing columns

-- Add updated_at to doctors table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'doctors' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE doctors ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updated_at column to doctors table';
    END IF;
END $$;

-- Add updated_at to consultations table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'consultations' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE consultations ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updated_at column to consultations table';
    END IF;
END $$;

-- Add profile_picture to doctors table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'doctors' AND column_name = 'profile_picture'
    ) THEN
        ALTER TABLE doctors ADD COLUMN profile_picture TEXT;
        RAISE NOTICE 'Added profile_picture column to doctors table';
    END IF;
END $$;

-- Add specialty to doctors table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'doctors' AND column_name = 'specialty'
    ) THEN
        ALTER TABLE doctors ADD COLUMN specialty VARCHAR(100);
        RAISE NOTICE 'Added specialty column to doctors table';
    END IF;
END $$;

-- Add phone to doctors table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'doctors' AND column_name = 'phone'
    ) THEN
        ALTER TABLE doctors ADD COLUMN phone VARCHAR(20);
        RAISE NOTICE 'Added phone column to doctors table';
    END IF;
END $$;

SELECT 'Schema update complete!' AS message;

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    doctor_id INT NOT NULL,
    message TEXT NOT NULL,
    unread BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- Add unread column if it doesn't exist
DO $ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'unread'
    ) THEN
        ALTER TABLE notifications ADD COLUMN unread BOOLEAN DEFAULT true;
        -- Set all existing notifications as unread
        UPDATE notifications SET unread = true WHERE unread IS NULL;
        RAISE NOTICE 'Added unread column to notifications table';
    END IF;
END $;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_doctor_id ON notifications(doctor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(unread);
