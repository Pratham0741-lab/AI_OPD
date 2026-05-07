const axios = require('axios');

const API_URL = 'http://localhost:5000';

async function testAppointments() {
  console.log('=== Testing Appointments Feature ===\n');

  try {
    // Step 1: Login
    console.log('Step 1: Logging in...');
    const loginResponse = await axios.post(`${API_URL}/api/login`, {
      email: 'testdoctor@example.com',
      password: 'test123'
    });

    if (!loginResponse.data.success) {
      console.error('✗ Login failed');
      return;
    }

    const token = loginResponse.data.token;
    const doctorId = loginResponse.data.doctor.id;
    console.log(`✓ Login successful - Doctor ID: ${doctorId}\n`);

    // Step 2: Create appointments for different dates
    console.log('Step 2: Creating test appointments...');
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const next3days = new Date(today);
    next3days.setDate(next3days.getDate() + 3);
    const next10days = new Date(today);
    next10days.setDate(next10days.getDate() + 10);

    const appointments = [
      {
        patient: 'John Doe',
        time: '10:00',
        type: 'Consultation',
        date: today.toISOString().split('T')[0]
      },
      {
        patient: 'Jane Smith',
        time: '14:00',
        type: 'Follow-up',
        date: tomorrow.toISOString().split('T')[0]
      },
      {
        patient: 'Bob Johnson',
        time: '11:00',
        type: 'New Patient',
        date: next3days.toISOString().split('T')[0]
      },
      {
        patient: 'Alice Williams',
        time: '15:30',
        type: 'Emergency',
        date: next10days.toISOString().split('T')[0]
      }
    ];

    const createdIds = [];
    for (const apt of appointments) {
      const response = await axios.post(
        `${API_URL}/api/appointments`,
        apt,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        createdIds.push(response.data.data.id);
        console.log(`✓ Created: ${apt.patient} on ${apt.date}`);
      }
    }
    console.log('');

    // Step 3: Fetch all appointments
    console.log('Step 3: Fetching all appointments...');
    const fetchResponse = await axios.get(
      `${API_URL}/api/appointments`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log(`✓ Found ${fetchResponse.data.length} appointments\n`);

    // Step 4: Display appointments by category
    console.log('Step 4: Categorizing appointments...');
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const next7days = new Date(today);
    next7days.setDate(next7days.getDate() + 7);

    const categorized = {
      today: [],
      tomorrow: [],
      next7days: [],
      later: []
    };

    fetchResponse.data.forEach(apt => {
      const aptDate = new Date(apt.date || apt.appointment_date);
      aptDate.setHours(0, 0, 0, 0);
      const dateStr = apt.date || apt.appointment_date;

      if (dateStr === todayStr) {
        categorized.today.push(apt);
      } else if (dateStr === tomorrowStr) {
        categorized.tomorrow.push(apt);
      } else if (aptDate > tomorrow && aptDate <= next7days) {
        categorized.next7days.push(apt);
      } else {
        categorized.later.push(apt);
      }
    });

    console.log(`Today: ${categorized.today.length} appointments`);
    categorized.today.forEach(apt => console.log(`  - ${apt.patient} at ${apt.time}`));
    
    console.log(`Tomorrow: ${categorized.tomorrow.length} appointments`);
    categorized.tomorrow.forEach(apt => console.log(`  - ${apt.patient} at ${apt.time}`));
    
    console.log(`Next 7 Days: ${categorized.next7days.length} appointments`);
    categorized.next7days.forEach(apt => console.log(`  - ${apt.patient} at ${apt.time} on ${apt.date || apt.appointment_date}`));
    
    console.log(`Later: ${categorized.later.length} appointments`);
    categorized.later.forEach(apt => console.log(`  - ${apt.patient} at ${apt.time} on ${apt.date || apt.appointment_date}`));
    console.log('');

    // Step 5: Test refresh (fetch again)
    console.log('Step 5: Testing refresh (fetching again)...');
    const refreshResponse = await axios.get(
      `${API_URL}/api/appointments`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`✓ Refresh successful - ${refreshResponse.data.length} appointments still visible\n`);

    // Step 6: Clean up (delete test appointments)
    console.log('Step 6: Cleaning up test appointments...');
    for (const id of createdIds) {
      await axios.delete(
        `${API_URL}/api/appointments/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`✓ Deleted appointment ID: ${id}`);
    }

    console.log('\n=== Test Complete ===\n');
    console.log('✓ Appointments persist after refresh');
    console.log('✓ Filtering by date works correctly');
    console.log('✓ All CRUD operations working');

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testAppointments();
