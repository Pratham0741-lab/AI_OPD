// Simple ASR connection test
require('dotenv').config();
const axios = require('axios');

async function testASR() {
  console.log('=== Simple ASR Connection Test ===\n');
  
  const ASR_ENDPOINT = process.env.ASR_ENDPOINT || 'http://27.111.72.51:8050/transcribe';
  
  console.log(`Testing endpoint: ${ASR_ENDPOINT}`);
  console.log(`ASR_ENABLED: ${process.env.ASR_ENABLED}`);
  
  // Test 1: Try to reach the base URL
  console.log('\nTest 1: Checking if server is reachable...');
  try {
    const baseUrl = ASR_ENDPOINT.replace('/transcribe', '');
    console.log(`Trying: ${baseUrl}`);
    
    const response = await axios.get(baseUrl, { timeout: 5000 });
    console.log('✓ Server responded!');
    console.log('Status:', response.status);
    console.log('Data:', response.data);
  } catch (error) {
    console.log('✗ Server not reachable');
    console.log('Error:', error.message);
    if (error.code) console.log('Code:', error.code);
  }
  
  // Test 2: Try the transcribe endpoint with GET
  console.log('\nTest 2: Checking transcribe endpoint (GET)...');
  try {
    const response = await axios.get(ASR_ENDPOINT, { timeout: 5000 });
    console.log('✓ Endpoint responded!');
    console.log('Status:', response.status);
    console.log('Data:', response.data);
  } catch (error) {
    console.log('✗ Endpoint error');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
  
  // Test 3: Check if it's a different port or path
  console.log('\nTest 3: Trying alternative endpoints...');
  const alternatives = [
    'http://27.111.72.51:8050/',
    'http://27.111.72.51:8050/asr',
    'http://27.111.72.51:8050/api/transcribe',
    'http://27.111.72.51:8000/transcribe'
  ];
  
  for (const url of alternatives) {
    try {
      console.log(`Trying: ${url}`);
      const response = await axios.get(url, { timeout: 3000 });
      console.log(`✓ ${url} responded!`);
      console.log('Status:', response.status);
    } catch (error) {
      console.log(`✗ ${url} - ${error.message}`);
    }
  }
  
  console.log('\n=== Test Complete ===');
}

testASR().catch(error => {
  console.error('Test failed:', error);
});
