// Test Notification System
const pool = require("./db");

async function testNotifications() {
  console.log("\n========================================");
  console.log("Testing Notification System");
  console.log("========================================\n");

  try {
    // Test 1: Check if notifications table exists
    console.log("Test 1: Checking notifications table...");
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'notifications'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log("✓ Notifications table exists");
    } else {
      console.log("❌ Notifications table does NOT exist");
      console.log("   Run: update-database.bat");
      return;
    }

    // Test 2: Check table structure
    console.log("\nTest 2: Checking table structure...");
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position;
    `);
    
    console.log("✓ Table columns:");
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    // Test 3: Check indexes
    console.log("\nTest 3: Checking indexes...");
    const indexes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'notifications';
    `);
    
    console.log("✓ Indexes:");
    indexes.rows.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

    // Test 4: Count notifications
    console.log("\nTest 4: Counting notifications...");
    const count = await pool.query("SELECT COUNT(*) FROM notifications");
    console.log(`✓ Total notifications: ${count.rows[0].count}`);

    // Test 5: Get recent notifications
    console.log("\nTest 5: Recent notifications...");
    const recent = await pool.query(`
      SELECT id, doctor_id, message, unread, created_at 
      FROM notifications 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (recent.rows.length > 0) {
      console.log("✓ Recent notifications:");
      recent.rows.forEach(notif => {
        console.log(`   [${notif.id}] ${notif.message} (${notif.unread ? 'unread' : 'read'})`);
      });
    } else {
      console.log("✓ No notifications yet (this is normal for new setup)");
    }

    console.log("\n========================================");
    console.log("All Notification Tests Passed! ✓");
    console.log("========================================\n");

  } catch (error) {
    console.error("\n❌ Notification Test Failed:");
    console.error(error.message);
    
    if (error.message.includes('relation "notifications" does not exist')) {
      console.log("\n⚠️  Notifications table not found!");
      console.log("Run this command to create it:");
      console.log("   update-database.bat");
      console.log("\nOR manually:");
      console.log("   psql -U postgres -d vocabopd -f backend\\update_schema.sql\n");
    }
  } finally {
    await pool.end();
  }
}

testNotifications();
