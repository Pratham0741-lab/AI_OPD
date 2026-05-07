const pool = require('./db');

async function checkTable() {
  try {
    console.log('=== Checking Appointments Table ===');
    
    // Check if table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'appointments'
      )
    `);
    
    console.log('Table exists:', tableExists.rows[0].exists);
    
    if (tableExists.rows[0].exists) {
      // Check columns
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        ORDER BY ordinal_position
      `);
      
      console.log('\nCurrent columns:');
      columns.rows.forEach(row => {
        console.log(`${row.column_name.padEnd(20)} ${row.data_type.padEnd(25)} ${row.is_nullable}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

checkTable();