// Simple test script to verify backend API is working
// Run with: node test-api.js

const http = require('http');

const BASE_URL = 'http://localhost:5000';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test functions
async function testRootEndpoint() {
  console.log('\n1️⃣  Testing Root Endpoint...');
  try {
    const result = await makeRequest('GET', '/');
    if (result.status === 200) {
      console.log('✅ Root endpoint working');
      console.log('   Response:', result.data.message);
    } else {
      console.log('❌ Root endpoint failed');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function testSaveConsultation() {
  console.log('\n2️⃣  Testing Save Consultation...');
  const testData = {
    patient: "Test Patient",
    age: "30",
    gender: "Male",
    symptoms: "Fever, Headache",
    medicalHistory: "None",
    transcript: "Patient complains of fever for 2 days",
    language: "english",
    date: new Date().toISOString(),
    time: new Date().toLocaleTimeString()
  };

  try {
    const result = await makeRequest('POST', '/api/consultation', testData);
    if (result.status === 200 && result.data.success) {
      console.log('✅ Consultation saved successfully');
      console.log('   Patient:', result.data.data.patient);
      console.log('   ID:', result.data.data.id);
      return result.data.data.id;
    } else {
      console.log('❌ Failed to save consultation');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  return null;
}

async function testGetConsultations() {
  console.log('\n3️⃣  Testing Get Consultations...');
  try {
    const result = await makeRequest('GET', '/api/history');
    if (result.status === 200) {
      console.log('✅ Consultations retrieved successfully');
      console.log('   Total consultations:', result.data.length);
      if (result.data.length > 0) {
        console.log('   Latest patient:', result.data[result.data.length - 1].patient);
      }
    } else {
      console.log('❌ Failed to get consultations');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function testGetConsultationById(id) {
  if (!id) return;
  
  console.log('\n4️⃣  Testing Get Consultation by ID...');
  try {
    const result = await makeRequest('GET', `/api/consultation/${id}`);
    if (result.status === 200) {
      console.log('✅ Consultation retrieved by ID');
      console.log('   Patient:', result.data.patient);
    } else {
      console.log('❌ Failed to get consultation by ID');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║     VocabOPD Backend API Tests            ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('\nMake sure the backend server is running on port 5000');
  console.log('Start it with: npm start\n');

  await testRootEndpoint();
  const consultationId = await testSaveConsultation();
  await testGetConsultations();
  await testGetConsultationById(consultationId);

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║     Tests Complete!                        ║');
  console.log('╚════════════════════════════════════════════╝\n');
}

// Check if server is running first
http.get(BASE_URL, () => {
  runTests();
}).on('error', () => {
  console.log('\n❌ Backend server is not running!');
  console.log('   Start it with: npm start');
  console.log('   Then run this test again: node test-api.js\n');
});
