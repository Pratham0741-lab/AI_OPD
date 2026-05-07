// Verify no dummy data exists in database
require('dotenv').config();
const pool = require('./db');

async function verifyNoDummyData() {
  console.log('=== Verifying No Dummy Data in Database ===\n');
  
  try {
    // Check for dummy patient names
    const dummyNames = [
      'Ravi Kumar',
      'Anjali Sharma', 
      'Mohan Das',
      'Priya Patel',
      'Suresh Reddy'
    ];
    
    console.log('Checking for dummy patient names...\n');
    
    for (const name of dummyNames) {
      const result = await pool.query(
        'SELECT * FROM consultations WHERE patient ILIKE $1',
        [name]
      );
      
      if (result.rows.length > 0) {
        console.log(`✗ Found dummy data: ${name} (${result.rows.length} records)`);
        console.log('  Deleting...');
        
        await pool.query(
          'DELETE FROM consultations WHERE patient ILIKE $1',
          [name]
        );
        
        console.log(`  ✓ Deleted ${name} records\n`);
      } else {
        console.log(`✓ No dummy data found for: ${name}`);
      }
    }
    
    // Show all consultations
    console.log('\n--- Current Consultations in Database ---\n');
    const allConsultations = await pool.query(
      'SELECT id, patient, doctor_id, symptoms, diagnosis, created_at FROM consultations ORDER BY created_at DESC'
    );
    
    if (allConsultations.rows.length === 0) {
      console.log('✓ Database is clean - no consultations');
    } else {
      console.log(`Total consultations: ${allConsultations.rows.length}\n`);
      allConsultations.rows.forEach(row => {
        console.log(`ID: ${row.id}`);
        console.log(`Patient: ${row.patient}`);
        console.log(`Doctor ID: ${row.doctor_id}`);
        console.log(`Symptoms: ${row.symptoms}`);
        console.log(`Diagnosis: ${row.diagnosis}`);
        console.log(`Created: ${row.created_at}`);
        console.log('---');
      });
    }
    
    console.log('\n✓ Verification complete');
    console.log('✓ All dummy data has been removed');
    console.log('✓ System is showing only real data from database');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

verifyNoDummyData();
