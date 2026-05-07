// Simple test without authentication
const axios = require('axios');

async function testSimple() {
  console.log('Testing /api/transcribe endpoint...\n');
  
  try {
    // Try GET first (should fail with 404 or 405)
    console.log('1. Testing GET request...');
    try {
      const response = await axios.get('http://localhost:5000/api/transcribe');
      console.log('GET response:', response.status, response.data);
    } catch (error) {
      console.log('GET error:', error.response?.status, error.response?.data || error.message);
    }
    
    // Try POST without auth (should fail with 401)
    console.log('\n2. Testing POST without auth...');
    try {
      const response = await axios.post('http://localhost:5000/api/transcribe', {});
      console.log('POST response:', response.status, response.data);
    } catch (error) {
      console.log('POST error:', error.response?.status, error.response?.data || error.message);
    }
    
    // Try OPTIONS (CORS preflight)
    console.log('\n3. Testing OPTIONS (CORS preflight)...');
    try {
      const response = await axios.options('http://localhost:5000/api/transcribe');
      console.log('OPTIONS response:', response.status, response.headers);
    } catch (error) {
      console.log('OPTIONS error:', error.response?.status, error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testSimple();
