const axios = require('axios');
const FormData = require('form-data');

const ASR_ENDPOINT = process.env.ASR_ENDPOINT || 'http://27.111.72.51:8050/transcribe';
const ASR_ENABLED = process.env.ASR_ENABLED === 'true';

console.log(`✓ ASR Service configured`);
console.log(`✓ Endpoint: ${ASR_ENDPOINT}`);
console.log(`✓ Status: ${ASR_ENABLED ? 'Enabled' : 'Disabled'}`);

/**
 * Transcribe audio file using Whisper ASR
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} filename - Original filename
 * @param {string} language - Language code (kannada, hindi, english)
 * @returns {Promise<Object>} - Transcription result
 */
async function transcribeAudio(audioBuffer, filename, language = 'kannada') {
  if (!ASR_ENABLED) {
    throw new Error('ASR service is not enabled');
  }

  try {
    console.log(`\n=== Transcribing Audio with Whisper ASR ===`);
    console.log(`File: ${filename}`);
    console.log(`Language: ${language}`);
    console.log(`Size: ${audioBuffer.length} bytes`);

    // Create form data
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: filename,
      contentType: 'audio/wav'
    });

    // Send request to Whisper ASR
    const response = await axios.post(ASR_ENDPOINT, formData, {
      headers: {
        ...formData.getHeaders(),
        'accept': 'application/json'
      },
      timeout: 60000 // 60 second timeout
    });

    console.log(`✓ Transcription successful`);
    console.log(`Response:`, JSON.stringify(response.data, null, 2));

    // Extract transcription text from response
    let transcriptionText = '';
    
    // Handle text field (can be string or array)
    if (response.data.text) {
      if (Array.isArray(response.data.text)) {
        // ASR server returns text as array - join them
        transcriptionText = response.data.text.join(' ').trim();
      } else {
        transcriptionText = response.data.text;
      }
    } else if (response.data.transcription) {
      if (Array.isArray(response.data.transcription)) {
        transcriptionText = response.data.transcription.join(' ').trim();
      } else {
        transcriptionText = response.data.transcription;
      }
    } else if (typeof response.data === 'string') {
      transcriptionText = response.data;
    } else {
      console.warn('Unexpected response format:', response.data);
      transcriptionText = JSON.stringify(response.data);
    }

    return {
      success: true,
      transcription: transcriptionText,
      language: language,
      duration: response.data.duration || null,
      confidence: response.data.confidence || null,
      raw: response.data
    };

  } catch (error) {
    console.error('ASR Transcription Error:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    throw new Error(`ASR transcription failed: ${error.message}`);
  }
}

/**
 * Test ASR connection
 */
async function testASRConnection() {
  try {
    console.log('\n=== Testing ASR Connection ===');
    console.log(`Endpoint: ${ASR_ENDPOINT}`);
    
    // Try to ping the endpoint
    const response = await axios.get(ASR_ENDPOINT.replace('/transcribe', '/'), {
      timeout: 5000
    });
    
    console.log('✓ ASR server is reachable');
    return true;
  } catch (error) {
    console.log('⚠ ASR server connection test failed:', error.message);
    return false;
  }
}

module.exports = {
  transcribeAudio,
  testASRConnection
};
