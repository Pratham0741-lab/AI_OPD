const pool = require('./db');

async function createAppointmentsTable() {
  try {
    console.log('=== Creating Appointments Table ===');
    
    // Create appointments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER REFERENCES doctors(id),
        patient VARCHAR(255) NOT NULL,
        time VARCHAR(20) NOT NULL,
        type VARCHAR(50) DEFAULT 'Consultation',
        appointment_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(20) DEFAULT 'scheduled',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✓ Appointments table created');
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)
    `);
    
    console.log('✓ Indexes created');
    
    // Check table structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'appointments' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nAppointments table structure:');
    console.log('=============================');
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(20)} ${row.data_type.padEnd(25)} ${row.is_nullable}`);
    });
    
    console.log('\n✓ Appointments table setup complete!');
    
  } catch (error) {
    console.error('Error creating appointments table:', error.message);
  } finally {
    pool.end();
  }
}

createAppointmentsTable();