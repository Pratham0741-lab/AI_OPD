// Test if backend AI service is working
require('dotenv').config({ path: __dirname + '/.env' });
const { generateMedicalReport } = require('./services/aiReportService');

async function testBackendAI() {
  console.log('\n=== Testing Backend AI Service ===\n');
  
  const transcript = `
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
    console.log('Calling generateMedicalReport...\n');
    const report = await generateMedicalReport(transcript, patientInfo);
    
    console.log('\n=== SUCCESS ===');
    console.log('AI Report Generated:\n');
    console.log(report);
    console.log('\n✓ Backend AI service is working correctly!\n');
    
  } catch (error) {
    console.error('\n=== ERROR ===');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    console.error('\n✗ Backend AI service failed!\n');
    console.error('Troubleshooting:');
    console.error('1. Is your vLLM server running at', process.env.OPENAI_BASE_URL);
    console.error('2. Check if the model is loaded:', process.env.OPENAI_MODEL);
    console.error('3. Try: node backend/test-ai-simple.js');
  }
}

testBackendAI();
