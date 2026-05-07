const pool = require('./db');

async function fixAppointmentsTable() {
  try {
    console.log('=== Fixing Appointments Table ===');
    
    // Add missing columns
    await pool.query(`
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS time VARCHAR(20)
    `);
    console.log('✓ Added time column');
    
    await pool.query(`
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'Consultation'
    `);
    console.log('✓ Added type column');
    
    await pool.query(`
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_date DATE DEFAULT CURRENT_DATE
    `);
    console.log('✓ Added appointment_date column');
    
    await pool.query(`
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'scheduled'
    `);
    console.log('✓ Added status column');
    
    await pool.query(`
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT
    `);
    console.log('✓ Added notes column');
    
    await pool.query(`
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    console.log('✓ Added updated_at column');
    
    // Rename patient_name to patient if needed
    const hasPatientName = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'patient_name'
      )
    `);
    
    if (hasPatientName.rows[0].exists) {
      await pool.query(`
        ALTER TABLE appointments RENAME COLUMN patient_name TO patient
      `);
      console.log('✓ Renamed patient_name to patient');
    }
    
    // Rename appointment_time to time if needed
    const hasAppointmentTime = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'appointment_time'
      )
    `);
    
    if (hasAppointmentTime.rows[0].exists) {
      await pool.query(`
        ALTER TABLE appointments RENAME COLUMN appointment_time TO time
      `);
      console.log('✓ Renamed appointment_time to time');
    }
    
    // Rename appointment_type to type if needed
    const hasAppointmentType = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'appointment_type'
      )
    `);
    
    if (hasAppointmentType.rows[0].exists) {
      await pool.query(`
        ALTER TABLE appointments RENAME COLUMN appointment_type TO type
      `);
      console.log('✓ Renamed appointment_type to type');
    }
    
    // Check final structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'appointments' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nFinal table structure:');
    console.log('=====================');
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(20)} ${row.data_type.padEnd(25)} ${row.is_nullable}`);
    });
    
    console.log('\n✓ Appointments table fixed successfully!');
    
  } catch (error) {
    console.error('Error fixing table:', error.message);
  } finally {
    pool.end();
  }
}

fixAppointmentsTable();