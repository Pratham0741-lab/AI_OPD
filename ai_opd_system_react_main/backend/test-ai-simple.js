// Simple AI test with detailed logging
require('dotenv').config({ path: __dirname + '/.env' });
const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key',
  baseURL: process.env.OPENAI_BASE_URL
});

async function testAI() {
  console.log('\n=== Testing AI Medical Report Generation ===\n');
  console.log('Endpoint:', process.env.OPENAI_BASE_URL);
  console.log('Model:', process.env.OPENAI_MODEL);
  console.log('\n');

  const transcript = `
Doctor: Good morning, how are you feeling today?
Patient: I have been having a high fever for the past 3 days, along with body ache and headache.
Doctor: Any other symptoms like cough or cold?
Patient: Yes, I have a mild cough as well.
Doctor: Let me check your temperature. It's 102°F. This looks like viral fever.
Patient: What should I do?
Doctor: I'll prescribe you Paracetamol 500mg three times a day for 5 days. Take rest and drink plenty of fluids.
  `;

  try {
    console.log('Sending request to AI...\n');
    
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a medical assistant. Generate a brief medical report.'
        },
        {
          role: 'user',
          content: `Analyze this consultation and provide: 1) Chief Complaint 2) Diagnosis 3) Prescription\n\n${transcript}`
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    console.log('=== FULL RESPONSE ===');
    console.log(JSON.stringify(response, null, 2));
    console.log('\n=== MESSAGE CONTENT ===');
    console.log(response.choices[0].message.content);
    console.log('\n✓ AI is working!\n');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\nStack:', error.stack);
  }
}

testAI();
