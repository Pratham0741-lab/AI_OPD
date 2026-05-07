const pool = require('./db');

async function checkDoctors() {
  try {
    const result = await pool.query('SELECT id, name, email FROM doctors');
    console.log(`\nDoctors in database: ${result.rows.length}\n`);
    
    if (result.rows.length > 0) {
      result.rows.forEach(doctor => {
        console.log(`  ID: ${doctor.id}`);
        console.log(`  Name: ${doctor.name}`);
        console.log(`  Email: ${doctor.email}`);
        console.log('  ---');
      });
    } else {
      console.log('  No doctors found. Please register a new doctor.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

checkDoctors();
