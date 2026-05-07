// Test date filtering logic locally
console.log('=== Testing Date Filtering Logic ===\n');

// Simulate the groupAppointmentsByDate function
function groupAppointmentsByDate(upcomingAppointments) {
  // Get current date components in local timezone
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  
  // Create date objects at midnight local time
  const today = new Date(currentYear, currentMonth, currentDay);
  const tomorrow = new Date(currentYear, currentMonth, currentDay + 1);
  const next7DaysEnd = new Date(currentYear, currentMonth, currentDay + 7);
  
  console.log(`Debug: Today is ${today.toDateString()} (${today.toISOString().split('T')[0]})`);
  console.log(`Debug: Tomorrow is ${tomorrow.toDateString()} (${tomorrow.toISOString().split('T')[0]})`);
  console.log(`Debug: Next 7 days end is ${next7DaysEnd.toDateString()} (${next7DaysEnd.toISOString().split('T')[0]})`);
  console.log('');
  
  const grouped = {
    today: [],
    tomorrow: [],
    next7days: [],
    upcoming: [],
    all: []
  };
  
  upcomingAppointments.forEach(appointment => {
    const appointmentDateStr = appointment.date || appointment.appointment_date;
    
    // Parse the appointment date string (YYYY-MM-DD)
    if (!appointmentDateStr) return;
    
    const dateParts = appointmentDateStr.split('-');
    if (dateParts.length !== 3) return;
    
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(dateParts[2], 10);
    
    // Create appointment date at midnight local time
    const appointmentDate = new Date(year, month, day);
    
    // Add to all
    grouped.all.push(appointment);
    
    // Get timestamps for comparison
    const aptTime = appointmentDate.getTime();
    const todayTime = today.getTime();
    const tomorrowTime = tomorrow.getTime();
    const next7DaysTime = next7DaysEnd.getTime();
    
    // Categorize by comparing timestamps
    if (aptTime === todayTime) {
      grouped.today.push(appointment);
    } else if (aptTime === tomorrowTime) {
      grouped.tomorrow.push(appointment);
    } else if (aptTime > tomorrowTime && aptTime <= next7DaysTime) {
      grouped.next7days.push(appointment);
    } else if (aptTime > next7DaysTime) {
      grouped.upcoming.push(appointment);
    }
  });
  
  return grouped;
}

// Create test appointments
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();
const currentDay = now.getDate();

const today = new Date(currentYear, currentMonth, currentDay);
const tomorrow = new Date(currentYear, currentMonth, currentDay + 1);
const day3 = new Date(currentYear, currentMonth, currentDay + 3);
const day5 = new Date(currentYear, currentMonth, currentDay + 5);
const day10 = new Date(currentYear, currentMonth, currentDay + 10);

// Format dates as YYYY-MM-DD
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const testAppointments = [
  {
    id: 1,
    patient: 'John Doe',
    time: '10:00',
    date: formatDate(today)
  },
  {
    id: 2,
    patient: 'Jane Smith',
    time: '14:00',
    date: formatDate(tomorrow)
  },
  {
    id: 3,
    patient: 'Bob Johnson',
    time: '11:00',
    date: formatDate(day3)
  },
  {
    id: 4,
    patient: 'Charlie Brown',
    time: '09:00',
    date: formatDate(day5)
  },
  {
    id: 5,
    patient: 'Alice Williams',
    time: '15:30',
    date: formatDate(day10)
  }
];

console.log('Test Appointments:');
testAppointments.forEach(apt => {
  console.log(`  ${apt.patient} - ${apt.date} at ${apt.time}`);
});
console.log('');

// Test the grouping
const grouped = groupAppointmentsByDate(testAppointments);

console.log('Grouped Results:');
console.log('');

console.log(`TODAY (${formatDate(today)}):`);
console.log(`  Count: ${grouped.today.length}`);
grouped.today.forEach(apt => {
  console.log(`  - ${apt.patient} at ${apt.time} (${apt.date})`);
});
console.log('');

console.log(`TOMORROW (${formatDate(tomorrow)}):`);
console.log(`  Count: ${grouped.tomorrow.length}`);
grouped.tomorrow.forEach(apt => {
  console.log(`  - ${apt.patient} at ${apt.time} (${apt.date})`);
});
console.log('');

console.log('NEXT 7 DAYS:');
console.log(`  Count: ${grouped.next7days.length}`);
grouped.next7days.forEach(apt => {
  console.log(`  - ${apt.patient} at ${apt.time} (${apt.date})`);
});
console.log('');

console.log('LATER (Beyond 7 days):');
console.log(`  Count: ${grouped.upcoming.length}`);
grouped.upcoming.forEach(apt => {
  console.log(`  - ${apt.patient} at ${apt.time} (${apt.date})`);
});
console.log('');

console.log('ALL:');
console.log(`  Count: ${grouped.all.length}`);
console.log('');

// Verify totals
const total = grouped.today.length + grouped.tomorrow.length + grouped.next7days.length + grouped.upcoming.length;
console.log('=== Verification ===');
console.log(`Total appointments: ${testAppointments.length}`);
console.log(`Categorized: ${total}`);
console.log(`All category: ${grouped.all.length}`);

if (total === testAppointments.length && grouped.all.length === testAppointments.length) {
  console.log('✓ All appointments categorized correctly!');
} else {
  console.log('✗ Categorization error!');
}
