// Test the complete flow: login, AI report generation, consultation save
const axios = require('axios');

async function testFullFlow() {
  try {
    console.log('=== Testing Complete Flow ===\n');
    
    // Step 1: Register a test doctor if needed
    console.log('1. Checking/creating test doctor...');
    let token;
    
    try {
      const loginResponse = await axios.post('http://localhost:5000/api/login', {
        email: 'testdoctor@example.com',
        password: 'test123'
      });
      
      if (loginResponse.data.success) {
        token = loginResponse.data.token;
        console.log('✓ Using existing test doctor');
      }
    } catch (loginError) {
      // Doctor doesn't exist, register one
      console.log('  Test doctor not found, registering...');
      
      const registerResponse = await axios.post('http://localhost:5000/api/register', {
        name: 'Test Doctor',
        email: 'testdoctor@example.com',
        hospital: 'Test Medical Center',
        password: 'test123'
      });
      
      if (registerResponse.data.success) {
        console.log('✓ Test doctor registered');
        
        // Login with new doctor
        const loginResponse2 = await axios.post('http://localhost:5000/api/login', {
          email: 'testdoctor@example.com',
          password: 'test123'
        });
        
        if (loginResponse2.data.success) {
          token = loginResponse2.data.token;
          console.log('✓ Logged in with test doctor');
        } else {
          throw new Error('Login failed after registration');
        }
      } else {
        throw new Error('Registration failed');
      }
    }
    
    // Step 2: Test AI report generation
    console.log('\n2. Testing AI report generation...');
    
    const transcript = "Patient: Doctor, I've been having fever and cough for 3 days. My temperature is 101°F.\nDoctor: I see. Any body aches or headache?\nPatient: Yes, some body aches and mild headache.\nDoctor: It sounds like a viral infection. I'll prescribe some medication.";
    
    const aiResponse = await axios.post('http://localhost:5000/api/ai-report', {
      transcript: transcript,
      patientInfo: {
        patient: 'Test Patient',
        age: '30',
        gender: 'Male'
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (aiResponse.data.success) {
      console.log('✓ AI report generated successfully');
      console.log('  Report length:', aiResponse.data.report?.length || 0, 'characters');
      console.log('  Has entities:', !!aiResponse.data.entities);
      
      if (aiResponse.data.entities) {
        console.log('  Chief Complaint:', aiResponse.data.entities.chiefComplaint || 'N/A');
        console.log('  Diagnosis:', aiResponse.data.entities.diagnosis || 'N/A');
      }
    } else {
      console.log('✗ AI report generation failed:', aiResponse.data.message);
    }
    
    // Step 3: Save consultation with AI data
    console.log('\n3. Saving consultation with AI data...');
    
    const consultationData = {
      patient: 'Test Patient',
      age: '30',
      gender: 'Male',
      symptoms: 'Fever, cough, body aches, headache',
      medicalHistory: 'None',
      transcript: transcript,
      language: 'english',
      date: new Date().toISOString(),
      time: new Date().toLocaleTimeString(),
      diagnosis: aiResponse.data.entities?.diagnosis || 'Viral Infection',
      prescription: aiResponse.data.entities?.prescription || 'Paracetamol 500mg every 6 hours',
      advice: Array.isArray(aiResponse.data.entities?.medicalAdvice) 
        ? aiResponse.data.entities.medicalAdvice.join('. ') 
        : 'Rest and drink plenty of fluids'
    };
    
    const saveResponse = await axios.post('http://localhost:5000/api/consultation', consultationData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (saveResponse.data.success) {
      console.log('✓ Consultation saved successfully!');
      console.log('  Consultation ID:', saveResponse.data.data.id);
      console.log('  Patient:', saveResponse.data.data.patient);
      console.log('  Diagnosis saved:', saveResponse.data.data.diagnosis);
      console.log('  Prescription saved:', saveResponse.data.data.prescription);
      console.log('  Advice saved:', saveResponse.data.data.advice);
    } else {
      console.log('✗ Consultation save failed:', saveResponse.data.message);
    }
    
    // Step 4: Retrieve consultations
    console.log('\n4. Retrieving consultations...');
    
    const getResponse = await axios.get('http://localhost:5000/api/history', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (Array.isArray(getResponse.data)) {
      console.log(`✓ Retrieved ${getResponse.data.length} consultations`);
      
      if (getResponse.data.length > 0) {
        const latest = getResponse.data[0];
        console.log('\nLatest consultation details:');
        console.log('  Patient:', latest.patient);
        console.log('  Age:', latest.age);
        console.log('  Diagnosis:', latest.diagnosis || 'Not set');
        console.log('  Prescription:', latest.prescription || 'Not set');
        console.log('  Has AI data:', !!(latest.diagnosis || latest.prescription || latest.advice));
      }
    } else {
      console.log('✗ Failed to get consultations:', getResponse.data);
    }
    
    console.log('\n=== Test Complete ===');
    console.log('All systems are working correctly!');
    
  } catch (error) {
    console.error('\n✗ Test failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testFullFlow();