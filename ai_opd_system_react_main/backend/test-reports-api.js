// Test Reports API endpoint
const fetch = require('node-fetch');

async function testReportsAPI() {
  console.log('=== Testing Reports API ===\n');
  
  // First login to get token
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
  
  console.log('✓ Login successful');
  console.log(`Token: ${loginData.token.substring(0, 50)}...\n`);
  
  const token = loginData.token;
  
  // Test GET /api/reports
  console.log('Step 2: Fetching all reports...');
  const reportsResponse = await fetch('http://localhost:5000/api/reports', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const reports = await reportsResponse.json();
  
  console.log(`✓ Fetched ${reports.length} reports\n`);
  
  if (reports.length > 0) {
    console.log('Sample Report:');
    console.log('─────────────────────────────────────');
    const report = reports[0];
    console.log(`Patient: ${report.patient}`);
    console.log(`Age: ${report.age}`);
    console.log(`Gender: ${report.gender}`);
    console.log(`Symptoms: ${report.symptoms}`);
    console.log(`Diagnosis: ${report.diagnosis}`);
    console.log(`Prescription: ${report.prescription || 'Not provided'}`);
    console.log(`Advice: ${report.advice || 'Not provided'}`);
    console.log(`Date: ${report.date}`);
    console.log(`Time: ${report.time}`);
    console.log(`Status: ${report.status}`);
    console.log(`AI Generated: ${report.aiGenerated}`);
    console.log(`Language: ${report.language}`);
    console.log('─────────────────────────────────────\n');
    
    // Test GET /api/report/:id
    console.log(`Step 3: Fetching specific report (ID: ${report.consultationId})...`);
    const reportResponse = await fetch(`http://localhost:5000/api/report/${report.consultationId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const reportData = await reportResponse.json();
    
    if (reportData.success) {
      console.log('✓ Report fetched successfully');
      console.log('\nDetailed Report:');
      console.log('─────────────────────────────────────');
      const detail = reportData.data;
      console.log(`Patient: ${detail.patient}`);
      console.log(`Diagnosis: ${detail.diagnosis}`);
      console.log(`Prescription: ${detail.prescription}`);
      console.log(`Advice: ${detail.advice}`);
      console.log(`Transcript: ${detail.transcript ? detail.transcript.substring(0, 100) + '...' : 'Not available'}`);
      console.log('─────────────────────────────────────\n');
    } else {
      console.error('✗ Failed to fetch report:', reportData.message);
    }
  } else {
    console.log('⚠ No reports found in database');
    console.log('Tip: Record a consultation to generate reports\n');
  }
  
  console.log('✓ All tests completed successfully!');
}

testReportsAPI().catch(error => {
  console.error('Test failed:', error);
});
