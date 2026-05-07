const axios = require('axios');

async function testLogin() {
  console.log('=== Testing Login Endpoint ===\n');
  
  // Test with one of the existing doctors
  const testCredentials = {
    email: 'testdoctor@example.com',
    password: 'test123'
  };
  
  console.log('Testing login with:');
  console.log('Email:', testCredentials.email);
  console.log('Password:', testCredentials.password);
  console.log('');
  
  try {
    const response = await axios.post('http://localhost:5000/api/login', testCredentials, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✓ Login successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('✗ Login failed');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

testLogin();
