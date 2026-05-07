const bcrypt = require('bcrypt');
const pool = require('./db');

async function createTestUser() {
  try {
    console.log('=== Creating Test User ===\n');
    
    const testUser = {
      name: 'Test User',
      email: 'test@test.com',
      hospital: 'Test Hospital',
      password: 'password123'
    };
    
    // Check if user already exists
    const existing = await pool.query(
      'SELECT * FROM doctors WHERE email = $1',
      [testUser.email]
    );
    
    if (existing.rows.length > 0) {
      console.log('✓ Test user already exists');
      console.log('Email:', testUser.email);
      console.log('Password:', testUser.password);
      console.log('\nYou can login with these credentials.');
      pool.end();
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    
    // Create user
    const result = await pool.query(
      'INSERT INTO doctors (name, email, hospital, password) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
      [testUser.name, testUser.email, testUser.hospital, hashedPassword]
    );
    
    console.log('✓ Test user created successfully!');
    console.log('\nLogin Credentials:');
    console.log('Email:', testUser.email);
    console.log('Password:', testUser.password);
    console.log('\nUser ID:', result.rows[0].id);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

createTestUser();
