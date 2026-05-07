// Test backend /api/transcribe endpoint
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function testBackendTranscribe() {
  console.log('=== Testing Backend /api/transcribe Endpoint ===\n');
  
  // Step 1: Login to get token
  console.log('Step 1: Logging in...');
  const loginResponse = await fetch('http://localhost:5000/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'test@test.com',
      password: 'password123'
    })
  });
  
  const loginData = await loginResponse.json();
  
  if (!loginData.success) {
    console.error('✗ Login failed:', loginData.message);
    return;
  }
  
  console.log('✓ Login successful\n');
  const token = loginData.token;
  
  // Step 2: Create a test audio file (minimal WAV)
  console.log('Step 2: Creating test audio file...');
  
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const duration = 1; // 1 second
  const numSamples = sampleRate * duration;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  buffer.fill(0, 44);
  
  console.log('✓ Test audio created (1 second silence)\n');
  
  // Step 3: Test transcribe endpoint
  console.log('Step 3: Testing /api/transcribe endpoint...');
  
  try {
    const formData = new FormData();
    formData.append('audio', buffer, {
      filename: 'test-audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('language', 'english');
    
    const response = await fetch('http://localhost:5000/api/transcribe', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    console.log('Response status:', response.status);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('\n✓ Transcription successful!');
      console.log('Result:', JSON.stringify(data, null, 2));
    } else {
      console.log('\n✗ Transcription failed');
      console.log('Error:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('\n✗ Request failed:', error.message);
  }
  
  console.log('\n=== Test Complete ===');
}

testBackendTranscribe().catch(console.error);
