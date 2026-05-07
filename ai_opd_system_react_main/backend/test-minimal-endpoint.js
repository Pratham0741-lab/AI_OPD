// Test the minimal server
const fetch = require('node-fetch');
const FormData = require('form-data');

async function test() {
  console.log('Testing minimal server on port 5001...\n');
  
  const buffer = Buffer.from('test audio data');
  const formData = new FormData();
  formData.append('audio', buffer, {
    filename: 'test.wav',
    contentType: 'audio/wav'
  });
  
  try {
    const response = await fetch('http://localhost:5001/api/transcribe', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
