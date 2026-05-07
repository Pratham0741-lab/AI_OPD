const pool = require('./db');

async function fixTable() {
  try {
    console.log('=== Fixing Consultations Table ===');
    
    // Add doctor_id column
    await pool.query(`
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS doctor_id INTEGER REFERENCES doctors(id)
    `);
    console.log('✓ Added doctor_id column');
    
    // Add medical_history column
    await pool.query(`
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS medical_history TEXT
    `);
    console.log('✓ Added medical_history column');
    
    // Add language column
    await pool.query(`
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'english'
    `);
    console.log('✓ Added language column');
    
    // Add consultation_date column
    await pool.query(`
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS consultation_date TIMESTAMP
    `);
    console.log('✓ Added consultation_date column');
    
    // Add consultation_time column
    await pool.query(`
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS consultation_time VARCHAR(20)
    `);
    console.log('✓ Added consultation_time column');
    
    // Add diagnosis column
    await pool.query(`
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS diagnosis TEXT
    `);
    console.log('✓ Added diagnosis column');
    
    // Add prescription column
    await pool.query(`
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS prescription TEXT
    `);
    console.log('✓ Added prescription column');
    
    // Add advice column
    await pool.query(`
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS advice TEXT
    `);
    console.log('✓ Added advice column');
    
    // Add updated_at column
    await pool.query(`
      ALTER TABLE consultations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    console.log('✓ Added updated_at column');
    
    // Update age column to be VARCHAR instead of INTEGER
    await pool.query(`
      ALTER TABLE consultations ALTER COLUMN age TYPE VARCHAR(10)
    `);
    console.log('✓ Updated age column to VARCHAR');
    
    // Display the updated table structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'consultations' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nUpdated table structure:');
    console.log('========================');
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(25)} ${row.data_type.padEnd(25)} ${row.is_nullable}`);
    });
    
    console.log('\n✓ Consultations table updated successfully!');
    
  } catch (error) {
    console.error('Error fixing table:', error.message);
  } finally {
    pool.end();
  }
}

fixTable();