// Simple test to check database connection and table structure
const pool = require('./db');

async function testDatabase() {
  try {
    console.log('=== Testing Database Connection ===');
    
    // Check doctors table
    const doctorsResult = await pool.query('SELECT COUNT(*) as count FROM doctors');
    console.log(`Doctors in database: ${doctorsResult.rows[0].count}`);
    
    // Check consultations table
    const consultationsResult = await pool.query('SELECT COUNT(*) as count FROM consultations');
    console.log(`Consultations in database: ${consultationsResult.rows[0].count}`);
    
    // Check table structure
    const tableStructure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'consultations' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nConsultations table structure:');
    tableStructure.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if there are any consultations with doctor_id
    const consultationsWithDoctor = await pool.query(`
      SELECT c.id, c.patient, c.diagnosis, c.prescription, c.advice, d.name as doctor_name
      FROM consultations c
      LEFT JOIN doctors d ON c.doctor_id = d.id
      ORDER BY c.created_at DESC
      LIMIT 5
    `);
    
    console.log('\nRecent consultations:');
    if (consultationsWithDoctor.rows.length > 0) {
      consultationsWithDoctor.rows.forEach(row => {
        console.log(`  ID: ${row.id}, Patient: ${row.patient}, Doctor: ${row.doctor_name || 'N/A'}`);
        console.log(`    Diagnosis: ${row.diagnosis || 'N/A'}`);
        console.log(`    Prescription: ${row.prescription || 'N/A'}`);
        console.log(`    Advice: ${row.advice || 'N/A'}`);
      });
    } else {
      console.log('  No consultations found');
    }
    
  } catch (error) {
    console.error('Database test failed:', error.message);
  } finally {
    pool.end();
  }
}

testDatabase();