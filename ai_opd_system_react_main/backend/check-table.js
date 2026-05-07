const pool = require('./db');

async function checkTable() {
  try {
    console.log('=== Checking Consultations Table Structure ===');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'consultations' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nConsultations table has the following columns:');
    console.log('===============================================');
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(20)} ${row.data_type.padEnd(20)} ${row.is_nullable}`);
    });
    
    // Check if doctor_id exists
    const hasDoctorId = result.rows.some(row => row.column_name === 'doctor_id');
    console.log(`\nHas doctor_id column: ${hasDoctorId}`);
    
    // Check if diagnosis, prescription, advice columns exist
    const hasDiagnosis = result.rows.some(row => row.column_name === 'diagnosis');
    const hasPrescription = result.rows.some(row => row.column_name === 'prescription');
    const hasAdvice = result.rows.some(row => row.column_name === 'advice');
    
    console.log(`Has diagnosis column: ${hasDiagnosis}`);
    console.log(`Has prescription column: ${hasPrescription}`);
    console.log(`Has advice column: ${hasAdvice}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

checkTable();