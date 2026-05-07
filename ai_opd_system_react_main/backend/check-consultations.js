const pool = require('./db');

async function checkConsultations() {
  try {
    const result = await pool.query(`
      SELECT id, patient, symptoms, diagnosis, 
             TO_CHAR(created_at, 'YYYY-MM-DD') as date 
      FROM consultations 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log(`\nConsultations in database: ${result.rows.length}\n`);
    
    if (result.rows.length > 0) {
      result.rows.forEach(c => {
        console.log(`Date: ${c.date}`);
        console.log(`Patient: ${c.patient}`);
        console.log(`Symptoms: ${c.symptoms}`);
        console.log(`Diagnosis: ${c.diagnosis || 'Pending'}`);
        console.log('---');
      });
    } else {
      console.log('No consultations found in database.');
      console.log('The dummy data you see must be from browser cache.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

checkConsultations();
