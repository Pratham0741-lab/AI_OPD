// Test custom AI endpoint
require('dotenv').config();
const { generateMedicalReport } = require('./services/aiReportService');

async function testCustomAI() {
  console.log('\n=== Testing Custom AI Endpoint ===\n');
  console.log('Endpoint:', process.env.OPENAI_BASE_URL);
  console.log('Model:', process.env.OPENAI_MODEL);
  console.log('\n');

  const testTranscript = `
Doctor: Good morning, how are you feeling today?
Patient: I have been having a high fever for the past 3 days, along with body ache and headache.
Doctor: Any other symptoms like cough or cold?
Patient: Yes, I have a mild cough as well.
Doctor: Let me check your temperature. It's 102°F. This looks like viral fever.
Patient: What should I do?
Doctor: I'll prescribe you Paracetamol 500mg three times a day for 5 days. Take rest and drink plenty of fluids.
  `;

  const patientInfo = {
    patient: 'Test Patient',
    age: 35,
    gender: 'Male'
  };

  try {
    console.log('Generating medical report...\n');
    const report = await generateMedicalReport(testTranscript, patientInfo);
    console.log('✓ AI Report Generated Successfully!\n');
    console.log('=== REPORT ===');
    console.log(report);
    console.log('\n✓ Custom AI endpoint is working correctly!');
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('\nPlease check:');
    console.error('1. Is the AI server running at', process.env.OPENAI_BASE_URL);
    console.error('2. Is the model name correct:', process.env.OPENAI_MODEL);
    console.error('3. Can you access the endpoint from this machine?');
  }
}

testCustomAI();
