// Simple test for vLLM connection
require('dotenv').config({ path: __dirname + '/.env' });
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
  baseURL: process.env.OPENAI_BASE_URL
});

async function testConnection() {
  console.log('\n=== Testing vLLM Connection ===\n');
  console.log('Endpoint:', process.env.OPENAI_BASE_URL);
  console.log('Model:', process.env.OPENAI_MODEL);
  console.log('\n');

  try {
    // Test 1: List models
    console.log('1. Listing available models...');
    const models = await client.models.list();
    console.log('✓ Models available:', models.data.map(m => m.id).join(', '));
    console.log('\n');

    // Test 2: Simple completion
    console.log('2. Testing chat completion...');
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages: [
        { role: 'user', content: 'Say "Hello, I am working!" in one sentence.' }
      ],
      max_tokens: 50,
      temperature: 0.7
    });

    console.log('✓ Response received:');
    console.log(response.choices[0].message.content);
    console.log('\n✓ vLLM connection is working perfectly!\n');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testConnection();
