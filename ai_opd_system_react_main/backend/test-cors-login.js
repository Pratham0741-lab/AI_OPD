// Test CORS and Login from frontend perspective
const fetch = require('node-fetch');

async function testLogin() {
  console.log('=== Testing Login with CORS ===\n');
  
  const testCases = [
    {
      origin: 'http://localhost:3002',
      email: 'test@test.com',
      password: 'password123'
    },
    {
      origin: 'http://127.0.0.1:3002',
      email: 'test@test.com',
      password: 'password123'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`Testing with origin: ${testCase.origin}`);
    console.log(`Email: ${testCase.email}`);
    console.log(`Password: ${testCase.password}\n`);
    
    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': testCase.origin
        },
        body: JSON.stringify({
          email: testCase.email,
          password: testCase.password
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('✓ Login successful!');
        console.log(`Token: ${data.token.substring(0, 50)}...`);
        console.log(`Doctor: ${data.doctor.name} (${data.doctor.email})\n`);
      } else {
        console.log('✗ Login failed');
        console.log(`Status: ${response.status}`);
        console.log(`Message: ${data.message}\n`);
      }
    } catch (error) {
      console.error('✗ Request failed:', error.message);
      console.error('');
    }
  }
}

testLogin();
