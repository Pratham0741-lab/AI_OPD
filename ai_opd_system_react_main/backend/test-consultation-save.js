// Test consultation saving
const axios = require('axios');

async function testConsultationSave() {
  try {
    console.log('=== Testing Consultation Save ===');
    
    // First, login to get a token
    const loginResponse = await axios.post('http://localhost:5000/api/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    
    if (!loginResponse.data.success) {
      console.log('Login failed, trying to register first...');
      
      // Try to register
      const registerResponse = await axios.post('http://localhost:5000/api/register', {
        name: 'Test Doctor',
        email: 'test@example.com',
        hospital: 'Test Hospital',
        password: 'password123'
      });
      
      if (!registerResponse.data.success) {
        console.error('Registration failed:', registerResponse.data.message);
        return;
      }
      
      console.log('Registration successful, trying login again...');
      
      // Login again
      const loginResponse2 = await axios.post('http://localhost:5000/api/login', {
        email: 'test@example.com',
        password: 'password123'
      });
      
      if (!loginResponse2.data.success) {
        console.error('Login failed after registration:', loginResponse2.data.message);
        return;
      }
      
      var token = loginResponse2.data.token;
    } else {
      var token = loginResponse.data.token;
    }
    
    console.log('✓ Login successful, token obtained');
    
    // Test consultation save
    const consultationData = {
      patient: 'John Doe',
      age: '35',
      gender: 'Male',
      symptoms: 'Fever, cough, headache',
      medicalHistory: 'None',
      transcript: 'Patient has been experiencing fever and cough for 3 days. Temperature is 101°F. No other symptoms.',
      language: 'english',
      date: new Date().toISOString(),
      time: new Date().toLocaleTimeString(),
      diagnosis: 'Viral Infection',
      prescription: 'Paracetamol 500mg every 6 hours for 3 days',
      advice: 'Rest and drink plenty of fluids'
    };
    
    const saveResponse = await axios.post('http://localhost:5000/api/consultation', consultationData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (saveResponse.data.success) {
      console.log('✓ Consultation saved successfully!');
      console.log('Consultation ID:', saveResponse.data.data.id);
      console.log('Patient:', saveResponse.data.data.patient);
      console.log('Diagnosis saved:', saveResponse.data.data.diagnosis);
      console.log('Prescription saved:', saveResponse.data.data.prescription);
    } else {
      console.error('Consultation save failed:', saveResponse.data.message);
    }
    
    // Test getting consultations
    const getResponse = await axios.get('http://localhost:5000/api/history', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (Array.isArray(getResponse.data)) {
      console.log(`✓ Retrieved ${getResponse.data.length} consultations`);
      if (getResponse.data.length > 0) {
        console.log('Latest consultation:', getResponse.data[0].patient);
      }
    } else {
      console.error('Failed to get consultations:', getResponse.data);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testConsultationSave();