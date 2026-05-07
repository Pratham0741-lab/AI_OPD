const pool = require("./db");

console.log("Testing PostgreSQL Connection...\n");

async function testConnection() {
  try {
    // Test basic connection
    console.log("1. Testing database connection...");
    const result = await pool.query('SELECT NOW()');
    console.log("✓ Database connected successfully");
    console.log("   Current time:", result.rows[0].now);
    
    // Check if tables exist
    console.log("\n2. Checking if tables exist...");
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('doctors', 'consultations')
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log("❌ Tables not found!");
      console.log("\n⚠️  Please run the SQL script to create tables:");
      console.log("   psql -U postgres -d vocabopd -f create_table.sql");
      console.log("\n   Or manually run the SQL commands from create_table.sql");
    } else {
      console.log("✓ Tables found:");
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      
      // Count records
      console.log("\n3. Counting records...");
      const doctorsCount = await pool.query('SELECT COUNT(*) FROM doctors');
      const consultationsCount = await pool.query('SELECT COUNT(*) FROM consultations');
      
      console.log(`   Doctors: ${doctorsCount.rows[0].count}`);
      console.log(`   Consultations: ${consultationsCount.rows[0].count}`);
    }
    
    console.log("\n✓ All tests passed!");
    console.log("✓ Backend is ready to start!");
    
  } catch (error) {
    console.error("\n❌ Connection test failed:");
    console.error("   Error:", error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log("\n⚠️  PostgreSQL server is not running!");
      console.log("   Start PostgreSQL service and try again.");
    } else if (error.code === '3D000') {
      console.log("\n⚠️  Database 'vocabopd' does not exist!");
      console.log("   Create it with: createdb -U postgres vocabopd");
    } else if (error.code === '28P01') {
      console.log("\n⚠️  Authentication failed!");
      console.log("   Check your password in backend/db.js");
    }
  } finally {
    await pool.end();
  }
}

testConnection();
