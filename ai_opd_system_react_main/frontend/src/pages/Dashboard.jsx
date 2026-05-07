import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { getConsultations, getAppointments, createAppointment, deleteAppointment } from "../services/api";
import { getProfilePicture } from "../utils/avatar";
import bloodTestSvg from "../assets/blood-test.svg";
import doctorsSvg from "../assets/doctors.svg";
import "../styles/global.css";
import "../styles/medical-colors.css";
import "../styles/dashboard-modern.css";

function Dashboard(){

const navigate = useNavigate();
const [profilePicture, setProfilePicture] = useState(null);
const [currentTime, setCurrentTime] = useState(new Date());
const [consultations, setConsultations] = useState([]);
const [doctorInfo, setDoctorInfo] = useState({
  name: "Doctor",
  email: "",
  hospital: ""
});

// Appointments state
const [upcomingAppointments, setUpcomingAppointments] = useState([]);
const [showAddAppointment, setShowAddAppointment] = useState(false);
const [newAppointment, setNewAppointment] = useState({
  patient: "",
  time: "",
  type: "Consultation",
  date: new Date().toISOString().split('T')[0] // Default to today
});
const [appointmentFilter, setAppointmentFilter] = useState("all"); // today, tomorrow, next7days, upcoming, all

const handleStartConsultation = () => {
  navigate("/record");
};

// Load doctor info and set profile picture
useEffect(() => {
  const savedDoctor = localStorage.getItem('doctor');
  const savedPicture = localStorage.getItem('profilePicture');

  if (savedDoctor) {
    const doctor = JSON.parse(savedDoctor);
    const name = doctor.name || "Doctor";
    setDoctorInfo({
      name: name,
      email: doctor.email || "",
      hospital: doctor.hospital || ""
    });
    
    // Set profile picture (custom or default avatar)
    setProfilePicture(getProfilePicture(savedPicture, name));
  }
}, []);

// Load consultations data
useEffect(() => {
  loadConsultations();
  loadAppointments();
}, []);

const loadConsultations = async () => {
  try {
    // Load from backend API only (no duplicates)
    const data = await getConsultations();
    // Ensure data is an array
    if (Array.isArray(data)) {
      setConsultations(data);
    } else {
      console.error("API returned non-array data:", data);
      setConsultations([]);
    }
  } catch (error) {
    console.error("Error loading consultations:", error);
    // Fallback to empty array
    setConsultations([]);
  }
};

const loadAppointments = async () => {
  try {
    // Load appointments from backend API
    const data = await getAppointments();
    // Ensure data is an array
    if (Array.isArray(data)) {
      setUpcomingAppointments(data);
    } else {
      console.error("API returned non-array data:", data);
      setUpcomingAppointments([]);
    }
  } catch (error) {
    console.error("Error loading appointments:", error);
    setUpcomingAppointments([]);
  }
};

// Update time every minute
useEffect(() => {
  const timer = setInterval(() => {
    setCurrentTime(new Date());
  }, 60000);
  return () => clearInterval(timer);
}, []);

// Calculate dynamic statistics
const totalPatients = Array.isArray(consultations) ? consultations.length : 0;
const today = new Date().toDateString();
const todayConsultations = Array.isArray(consultations) ? consultations.filter(c => {
  if (c.date) {
    const consultDate = new Date(c.date).toDateString();
    return consultDate === today;
  }
  return false;
}).length : 0;

const stats = [
  {
    title: "Today's Patients",
    value: todayConsultations.toString(),
    change: "+12%",
    trend: "up",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    ),
    color: "#3b82f6"
  },
  {
    title: "Consultations",
    value: totalPatients.toString(),
    change: "+8%",
    trend: "up",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
      </svg>
    ),
    color: "#10b981"
  },
  {
    title: "Reports Generated",
    value: totalPatients.toString(),
    change: "+5%",
    trend: "up",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
    ),
    color: "#f59e0b"
  },
  {
    title: "Pending Reviews",
    value: "3",
    change: "-2",
    trend: "down",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    ),
    color: "#ef4444"
  }
];

// Use real consultation data for recent patients
const recentPatients = Array.isArray(consultations) ? consultations.slice(0, 4).map(consultation => ({
  name: consultation.patient,
  time: consultation.time || "N/A",
  status: consultation.diagnosis ? "Completed" : "In Progress",
  diagnosis: consultation.diagnosis || "Pending"
})) : [];

// Group appointments by date
const groupAppointmentsByDate = () => {
  // Get current date components in local timezone
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  
  // Create date objects at midnight local time
  const today = new Date(currentYear, currentMonth, currentDay);
  const tomorrow = new Date(currentYear, currentMonth, currentDay + 1);
  const next7DaysEnd = new Date(currentYear, currentMonth, currentDay + 7);
  
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
};

const handleAddAppointment = async () => {
  if (!newAppointment.patient || !newAppointment.time) {
    alert("Please fill in patient name and time");
    return;
  }

  try {
    const result = await createAppointment(newAppointment);
    
    if (result.success) {
      // Reload appointments from database
      loadAppointments();
      setNewAppointment({ patient: "", time: "", type: "Consultation", date: new Date().toISOString().split('T')[0] });
      setShowAddAppointment(false);
      alert("Appointment saved successfully!");
    } else {
      alert("Failed to save appointment: " + result.message);
    }
  } catch (error) {
    console.error("Error creating appointment:", error);
    alert("Failed to save appointment. Please try again.");
  }
};

const handleDeleteAppointment = async (id) => {
  if (window.confirm("Are you sure you want to delete this appointment?")) {
    try {
      const result = await deleteAppointment(id);
      
      if (result.success) {
        // Reload appointments from database
        loadAppointments();
        alert("Appointment deleted successfully!");
      } else {
        alert("Failed to delete appointment: " + result.message);
      }
    } catch (error) {
      console.error("Error deleting appointment:", error);
      alert("Failed to delete appointment. Please try again.");
    }
  }
};

// Get filtered appointments based on selected filter
const getFilteredAppointments = () => {
  const grouped = groupAppointmentsByDate();
  
  switch (appointmentFilter) {
    case "today":
      return grouped.today;
    case "tomorrow":
      return grouped.tomorrow;
    case "next7days":
      return grouped.next7days;
    case "upcoming":
      return grouped.upcoming;
    case "all":
      return grouped.all;
    default:
      return grouped.all;
  }
};

const filteredAppointments = getFilteredAppointments();

return(

<div className="dashboard-container">

<Sidebar/>

<div className="dashboard-main">

<Navbar profilePicture={profilePicture} pageTitle="Dashboard" />

<div className="dashboard-content">

{/* Hero Section with SVG */}
<div className="hero-section">
  <div className="hero-content">
    <div className="hero-text">
      <h1>Welcome back, Dr. {doctorInfo.name}</h1>
      <p className="hero-subtitle">{doctorInfo.hospital || "Medical Professional"}</p>
      <p className="hero-date">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
      <button className="hero-cta-btn" onClick={handleStartConsultation}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Start New Consultation
      </button>
    </div>
    <div className="hero-image">
      <img src={doctorsSvg} alt="Medical Professionals" />
    </div>
  </div>
</div>

{/* Stats Grid */}
<div className="stats-grid-modern">
  {stats.map((stat, index) => (
    <div key={index} className="stat-card-modern">
      <div className="stat-icon" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
        {stat.icon}
      </div>
      <div className="stat-content">
        <p className="stat-title">{stat.title}</p>
        <h3 className="stat-value">{stat.value}</h3>
        <div className={`stat-change ${stat.trend}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {stat.trend === 'up' ? (
              <polyline points="18 15 12 9 6 15"></polyline>
            ) : (
              <polyline points="6 9 12 15 18 9"></polyline>
            )}
          </svg>
          <span>{stat.change} from yesterday</span>
        </div>
      </div>
    </div>
  ))}
</div>

{/* Main Content Grid */}
<div className="dashboard-grid">

  {/* Recent Patients */}
  <div className="dashboard-card">
    <div className="card-header">
      <h3>Recent Patients</h3>
      <button className="view-all-btn" onClick={() => navigate('/patients')}>
        View All
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
    <div className="patients-list">
      {recentPatients.map((patient, index) => (
        <div key={index} className="patient-item">
          <div className="patient-avatar">
            {patient.name.charAt(0)}
          </div>
          <div className="patient-info">
            <h4>{patient.name}</h4>
            <p>{patient.diagnosis}</p>
          </div>
          <div className="patient-meta">
            <span className="patient-time">{patient.time}</span>
            <span className={`patient-status ${patient.status.toLowerCase().replace(' ', '-')}`}>
              {patient.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>

  {/* Upcoming Appointments */}
  <div className="dashboard-card">
    <div className="card-header">
      <h3>Upcoming Appointments</h3>
      <button className="add-btn" onClick={() => setShowAddAppointment(!showAddAppointment)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add
      </button>
    </div>

    {/* Appointment Filter Tabs */}
    <div className="appointment-filter-tabs">
      <button 
        className={`filter-tab ${appointmentFilter === 'today' ? 'active' : ''}`}
        onClick={() => setAppointmentFilter('today')}
      >
        Today
      </button>
      <button 
        className={`filter-tab ${appointmentFilter === 'tomorrow' ? 'active' : ''}`}
        onClick={() => setAppointmentFilter('tomorrow')}
      >
        Tomorrow
      </button>
      <button 
        className={`filter-tab ${appointmentFilter === 'next7days' ? 'active' : ''}`}
        onClick={() => setAppointmentFilter('next7days')}
      >
        Next 7 Days
      </button>
      <button 
        className={`filter-tab ${appointmentFilter === 'upcoming' ? 'active' : ''}`}
        onClick={() => setAppointmentFilter('upcoming')}
      >
        Later
      </button>
      <button 
        className={`filter-tab ${appointmentFilter === 'all' ? 'active' : ''}`}
        onClick={() => setAppointmentFilter('all')}
      >
        All
      </button>
    </div>

    {showAddAppointment && (
      <div className="add-appointment-form">
        <input
          type="text"
          placeholder="Patient Name"
          value={newAppointment.patient}
          onChange={(e) => setNewAppointment({...newAppointment, patient: e.target.value})}
          className="appointment-input"
        />
        <input
          type="time"
          value={newAppointment.time}
          onChange={(e) => setNewAppointment({...newAppointment, time: e.target.value})}
          className="appointment-input"
        />
        <input
          type="date"
          value={newAppointment.date}
          onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
          className="appointment-input"
        />
        <select
          value={newAppointment.type}
          onChange={(e) => setNewAppointment({...newAppointment, type: e.target.value})}
          className="appointment-input"
        >
          <option value="Consultation">Consultation</option>
          <option value="Follow-up">Follow-up</option>
          <option value="New Patient">New Patient</option>
          <option value="Emergency">Emergency</option>
        </select>
        <div className="appointment-form-actions">
          <button className="btn-save" onClick={handleAddAppointment}>Save</button>
          <button className="btn-cancel" onClick={() => setShowAddAppointment(false)}>Cancel</button>
        </div>
      </div>
    )}

    <div className="appointments-list">
      {filteredAppointments.length > 0 ? (
        filteredAppointments.map((appointment) => (
          <div key={appointment.id} className="appointment-item">
            <div className="appointment-time">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>{appointment.time}</span>
            </div>
            <div className="appointment-details">
              <h4>{appointment.patient}</h4>
              <span className="appointment-type">{appointment.type}</span>
              <div className="appointment-date">
                {new Date(appointment.date || appointment.appointment_date).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>
            <button 
              className="delete-appointment-btn" 
              onClick={() => handleDeleteAppointment(appointment.id)}
              title="Delete appointment"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        ))
      ) : (
        <div className="no-appointments">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <h4>No appointments {appointmentFilter === 'all' ? '' : `for ${appointmentFilter === 'next7days' ? 'next 7 days' : appointmentFilter}`}</h4>
          <p>{appointmentFilter === 'all' ? 'Click "Add" to schedule your first appointment' : 'Try selecting a different time range'}</p>
        </div>
      )}
    </div>
  </div>

</div>

{/* Professional Insights Section */}
<div className="insights-section">
  <div className="insights-card">
    <div className="insights-content">
      <h3>AI-Powered Medical Insights</h3>
      <p>Leverage advanced AI technology to generate comprehensive medical reports, analyze patient symptoms, and provide accurate diagnoses in multiple languages.</p>
      <ul className="insights-features">
        <li>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Automated Report Generation
        </li>
        <li>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Voice-Powered Medication Adherence Calls
        </li>
        <li>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Multi-language Support (English, Hindi, Kannada + 8 more)
        </li>
        <li>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Digital Prescription Management
        </li>
      </ul>
      <button className="insights-btn" onClick={() => navigate('/reports')}>
        View All Reports
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
    <div className="insights-image">
      <img src={bloodTestSvg} alt="Medical Analysis" />
    </div>
  </div>
</div>

{/* Quick Actions */}
<div className="quick-actions-professional">
  <h3>Quick Actions</h3>
  <div className="actions-grid-professional">
    <button className="action-card-professional" onClick={() => navigate('/record')}>
      <div className="action-icon-professional" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </div>
      <h4>Record Consultation</h4>
      <p>Start a new patient consultation with AI assistance</p>
    </button>
    <button className="action-card-professional" onClick={() => navigate('/patients')}>
      <div className="action-icon-professional" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        </svg>
      </div>
      <h4>Patient History</h4>
      <p>Access complete patient records and history</p>
    </button>
    <button className="action-card-professional" onClick={() => navigate('/reports')}>
      <div className="action-icon-professional" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      </div>
      <h4>Medical Reports</h4>
      <p>Generate and manage AI-powered reports</p>
    </button>
    <button className="action-card-professional" onClick={() => navigate('/profile')}>
      <div className="action-icon-professional" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
      <h4>My Profile</h4>
      <p>Manage your professional information</p>
    </button>
    <button className="action-card-professional" onClick={() => navigate('/record')}>
      <div className="action-icon-professional" style={{ background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
      </div>
      <h4>Health Check Calls</h4>
      <p>Automated medication adherence phone calls</p>
    </button>
  </div>
</div>

</div>

</div>

</div>

);

}

export default Dashboard;