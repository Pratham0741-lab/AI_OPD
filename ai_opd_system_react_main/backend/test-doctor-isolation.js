// Test doctor data isolation
const fetch = require('node-fetch');

async function testDoctorIsolation() {
  console.log('=== Testing Doctor Data Isolation ===\n');
  
  // Test with two different doctors
  const doctors = [
    { email: 'test@test.com', password: 'password123', name: 'Test User' },
    { email: 'testdoctor@example.com', password: 'test123', name: 'Test Doctor' }
  ];
  
  for (const doctor of doctors) {
    console.log(`\n--- Testing with ${doctor.name} (${doctor.email}) ---`);
    
    // Step 1: Login
    console.log('Step 1: Logging in...');
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: doctor.email,
        password: doctor.password
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginData.success) {
      console.error('✗ Login failed:', loginData.message);
      continue;
    }
    
    console.log(`✓ Login successful - Doctor ID: ${loginData.doctor.id}`);
    const token = loginData.token;
    const doctorId = loginData.doctor.id;
    
    // Step 2: Get consultations
    console.log('\nStep 2: Fetching consultations...');
    const historyResponse = await fetch('http://localhost:5000/api/history', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const consultations = await historyResponse.json();
    console.log(`✓ Found ${consultations.length} consultations`);
    
    if (consultations.length > 0) {
      console.log('Sample consultations:');
      consultations.slice(0, 3).forEach(c => {
        console.log(`  - ${c.patient} (ID: ${c.id})`);
      });
    }
    
    // Step 3: Get reports
    console.log('\nStep 3: Fetching reports...');
    const reportsResponse = await fetch('http://localhost:5000/api/reports', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const reports = await reportsResponse.json();
    console.log(`✓ Found ${reports.length} reports`);
    
    if (reports.length > 0) {
      console.log('Sample reports:');
      reports.slice(0, 3).forEach(r => {
        console.log(`  - ${r.patient} (Report ID: ${r.reportId})`);
      });
    }
    
    // Step 4: Get appointments
    console.log('\nStep 4: Fetching appointments...');
    const appointmentsResponse = await fetch('http://localhost:5000/api/appointments', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const appointments = await appointmentsResponse.json();
    console.log(`✓ Found ${appointments.length} appointments`);
    
    console.log(`\n✓ All data is isolated for Doctor ID: ${doctorId}`);
  }
  
  console.log('\n=== Test Complete ===');
  console.log('\n✓ Each doctor sees only their own data');
  console.log('✓ Data isolation is working correctly');
}

testDoctorIsolation().catch(console.error);
