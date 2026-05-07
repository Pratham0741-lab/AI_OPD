import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import ImageCropper from "../components/ImageCropper";
import ChangePasswordModal from "../components/ChangePasswordModal";
import NotificationSettings from "../components/NotificationSettings";
import PreferencesModal from "../components/PreferencesModal";
import { updateProfile, createNotification, getProfile, getNotifications } from "../services/api";
import { getProfilePicture } from "../utils/avatar";
import "../styles/global.css";
import "../styles/medical-colors.css";
import "../styles/cropper.css";
import "../styles/profile-modern.css";

function Profile(){

const [isEditing, setIsEditing] = useState(false);
const [profilePicture, setProfilePicture] = useState(null);
const [displayPicture, setDisplayPicture] = useState(null);
const [tempImage, setTempImage] = useState(null);
const [showCropper, setShowCropper] = useState(false);
const [showPasswordModal, setShowPasswordModal] = useState(false);
const [showNotificationSettings, setShowNotificationSettings] = useState(false);
const [showPreferences, setShowPreferences] = useState(false);
const [profileData, setProfileData] = useState({
name: "",
specialty: "",
email: "",
phone: "",
hospital: "",
experience: "",
location: "",
license: "",
education: ""
});

const [editData, setEditData] = useState({ ...profileData });
const [recentActivity, setRecentActivity] = useState([]);

// Load doctor data from localStorage and backend on mount
useEffect(() => {
  loadProfileData();
  loadRecentActivity();
}, []);

const loadRecentActivity = async () => {
  try {
    const result = await getNotifications();
    if (result.success && result.notifications) {
      // Group notifications by activity type and keep only the most recent of each type
      const activityMap = new Map();
      
      result.notifications.forEach(notif => {
        // Extract activity type (e.g., "Profile updated", "Consultation saved", "Report generated")
        let activityType = notif.message;
        
        // Normalize activity types
        if (notif.message.includes('Profile updated')) {
          activityType = 'Profile updated';
        } else if (notif.message.includes('Password changed')) {
          activityType = 'Password changed';
        } else if (notif.message.includes('Consultation saved')) {
          activityType = 'Consultation saved';
        } else if (notif.message.includes('report generated') || notif.message.includes('Report generated')) {
          activityType = 'Report generated';
        } else if (notif.message.includes('Prescription downloaded')) {
          activityType = 'Prescription downloaded';
        }
        
        // Keep only the most recent notification of each type
        if (!activityMap.has(activityType) || new Date(notif.time) > new Date(activityMap.get(activityType).time)) {
          activityMap.set(activityType, notif);
        }
      });
      
      // Convert map to array and take the 3 most recent unique activities
      const uniqueActivities = Array.from(activityMap.values())
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 3)
        .map(notif => ({
          title: notif.message.split(' for ')[0] || notif.message,
          description: notif.message.includes(' for ') ? notif.message.split(' for ')[1] : '',
          time: formatTime(notif.time),
          icon: getActivityIcon(notif.message)
        }));
      
      setRecentActivity(uniqueActivities);
    }
  } catch (error) {
    console.error("Error loading recent activity:", error);
  }
};

const formatTime = (timestamp) => {
  const now = new Date();
  const activityTime = new Date(timestamp);
  const diffMs = now - activityTime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return activityTime.toLocaleDateString();
};

const getActivityIcon = (message) => {
  if (message.includes('Consultation')) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    );
  } else if (message.includes('report') || message.includes('Report')) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
    );
  } else if (message.includes('Profile') || message.includes('Password')) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    );
  } else {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4"></path>
        <path d="M12 8h.01"></path>
      </svg>
    );
  }
};

const loadProfileData = async () => {
  // Load from localStorage first
  const savedDoctor = localStorage.getItem('doctor');
  const savedProfile = localStorage.getItem('doctorProfile');
  const savedPicture = localStorage.getItem('profilePicture');

  if (savedPicture) {
    setProfilePicture(savedPicture);
  }

  // Try to load from backend
  try {
    const result = await getProfile();
    if (result.success) {
      const doctor = result.doctor;
      const profile = {
        name: doctor.name || "",
        specialty: doctor.specialty || "",
        email: doctor.email || "",
        phone: doctor.phone || "",
        hospital: doctor.hospital || "",
        experience: doctor.experience || "",
        location: doctor.location || "",
        license: doctor.license || "",
        education: doctor.education || ""
      };
      setProfileData(profile);
      setEditData(profile);
      
      // Set display picture (custom or default avatar)
      setDisplayPicture(getProfilePicture(savedPicture, profile.name));
      
      // Update localStorage
      localStorage.setItem('doctorProfile', JSON.stringify(profile));
      return;
    }
  } catch (error) {
    console.error("Error loading profile from backend:", error);
  }

  // Fallback to localStorage
  if (savedProfile) {
    const profile = JSON.parse(savedProfile);
    setProfileData(profile);
    setEditData(profile);
    setDisplayPicture(getProfilePicture(savedPicture, profile.name));
  } else if (savedDoctor) {
    const doctor = JSON.parse(savedDoctor);
    const initialProfile = {
      name: doctor.name || "",
      specialty: "",
      email: doctor.email || "",
      phone: "",
      hospital: doctor.hospital || "",
      experience: "",
      location: "",
      license: "",
      education: ""
    };
    setProfileData(initialProfile);
    setEditData(initialProfile);
    setDisplayPicture(getProfilePicture(savedPicture, initialProfile.name));
  }
};

const handleEdit = () => {
setIsEditing(true);
setEditData({ ...profileData });
};

const handleCancel = () => {
setIsEditing(false);
setEditData({ ...profileData });
};

const handleSave = async () => {
  try {
    // Update backend
    const result = await updateProfile({
      name: editData.name,
      hospital: editData.hospital,
      specialty: editData.specialty,
      phone: editData.phone,
      experience: editData.experience,
      location: editData.location,
      license: editData.license,
      education: editData.education
    });
    
    if (result.success) {
      // Update local state
      setProfileData({ ...editData });
      setIsEditing(false);
      
      // Update localStorage
      localStorage.setItem('doctorProfile', JSON.stringify(editData));
      
      // Update doctor info in localStorage
      const doctor = JSON.parse(localStorage.getItem('doctor') || '{}');
      doctor.name = editData.name;
      doctor.hospital = editData.hospital;
      localStorage.setItem('doctor', JSON.stringify(doctor));
      
      // If no custom profile picture, regenerate default avatar with new name
      if (!profilePicture) {
        const newDefaultAvatar = getProfilePicture(null, editData.name);
        setDisplayPicture(newDefaultAvatar);
      } else {
        // Keep custom picture
        localStorage.setItem('profilePicture', profilePicture);
      }
      
      // Create notification
      await createNotification("Profile updated successfully");
      
      alert("Profile updated successfully!");
    } else {
      alert(result.message || "Failed to update profile");
    }
  } catch (error) {
    console.error("Profile update error:", error);
    alert("Failed to update profile. Please try again.");
  }
};

const handleChange = (e) => {
setEditData({
...editData,
[e.target.name]: e.target.value
});
};

const handlePictureChange = (e) => {
const file = e.target.files[0];
if (file) {
const reader = new FileReader();
reader.onloadend = () => {
setTempImage(reader.result);
setShowCropper(true);
};
reader.readAsDataURL(file);
}
};

const handleCropComplete = (croppedImage) => {
setProfilePicture(croppedImage);
setDisplayPicture(croppedImage);
localStorage.setItem('profilePicture', croppedImage);
setShowCropper(false);
setTempImage(null);
};

const handleCropCancel = () => {
setShowCropper(false);
setTempImage(null);
};

const handleRemovePicture = () => {
  // Remove custom picture and revert to default avatar
  setProfilePicture(null);
  localStorage.removeItem('profilePicture');
  
  // Update display picture to default avatar
  const defaultAvatar = getProfilePicture(null, profileData.name);
  setDisplayPicture(defaultAvatar);
  
  // Create notification
  createNotification("Profile picture removed");
};

React.useEffect(() => {
const savedProfile = localStorage.getItem('doctorProfile');
const savedPicture = localStorage.getItem('profilePicture');
if (savedProfile) {
const data = JSON.parse(savedProfile);
setProfileData(data);
setEditData(data);
}
if (savedPicture) {
setProfilePicture(savedPicture);
}
}, []);

return(

<>

<div className="dashboard-container">

<Sidebar/>

<div className="dashboard-main">

<Navbar profilePicture={profilePicture} pageTitle="My Profile" />

<div className="dashboard-content">

<div className="profile-container">

<div className="profile-header-card">
<div className="profile-picture-section">
<img
src={displayPicture}
alt="doctor"
className="profile-picture-large"
/>
<label htmlFor="picture-upload" className="change-picture-btn-large">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
<circle cx="12" cy="13" r="4"></circle>
</svg>
</label>
{profilePicture && (
<button 
  className="remove-picture-btn-large" 
  onClick={handleRemovePicture}
  title="Remove profile picture"
>
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<polyline points="3 6 5 6 21 6"></polyline>
<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
</svg>
</button>
)}
<input
id="picture-upload"
type="file"
accept="image/*"
onChange={handlePictureChange}
style={{ display: 'none' }}
/>
</div>

<div className="profile-header-info">
<h1>{profileData.name || "Doctor"}</h1>
<p>{profileData.specialty || "Not provided"} • {profileData.hospital || "Hospital"}</p>
<div className="profile-stats">
<div className="profile-stat">
<span className="profile-stat-value">{profileData.experience || "Not Set"}</span>
<span className="profile-stat-label">Experience</span>
</div>
<div className="profile-stat">
<span className="profile-stat-value">{profileData.location || "Not Set"}</span>
<span className="profile-stat-label">Location</span>
</div>
<div className="profile-stat">
<span className="profile-stat-value">{profileData.license || "Not Set"}</span>
<span className="profile-stat-label">License</span>
</div>
</div>
</div>
</div>

<div className="profile-content-grid">

<div className="profile-main-card">
<div className="profile-card-header">
<h2>
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
<circle cx="12" cy="7" r="4"></circle>
</svg>
Personal Information
</h2>
</div>

<div className="profile-card-body">
<div className="profile-form-grid">

<div className="profile-form-group">
<label className="profile-form-label">Full Name</label>
{isEditing ? (
<input
type="text"
name="name"
value={editData.name}
onChange={handleChange}
className="profile-form-input"
/>
) : (
<div className="profile-form-value">{profileData.name || "Not provided"}</div>
)}
</div>

<div className="profile-form-group">
<label className="profile-form-label">Specialty</label>
{isEditing ? (
<input
type="text"
name="specialty"
value={editData.specialty}
onChange={handleChange}
className="profile-form-input"
/>
) : (
<div className="profile-form-value">{profileData.specialty || "Not provided"}</div>
)}
</div>

<div className="profile-form-group">
<label className="profile-form-label">Email Address</label>
{isEditing ? (
<input
type="email"
name="email"
value={editData.email}
onChange={handleChange}
className="profile-form-input"
/>
) : (
<div className="profile-form-value">{profileData.email || "Not provided"}</div>
)}
</div>

<div className="profile-form-group">
<label className="profile-form-label">Phone Number</label>
{isEditing ? (
<input
type="tel"
name="phone"
value={editData.phone}
onChange={handleChange}
className="profile-form-input"
/>
) : (
<div className="profile-form-value">{profileData.phone || "Not provided"}</div>
)}
</div>

<div className="profile-form-group">
<label className="profile-form-label">Hospital/Clinic</label>
{isEditing ? (
<input
type="text"
name="hospital"
value={editData.hospital}
onChange={handleChange}
className="profile-form-input"
/>
) : (
<div className="profile-form-value">{profileData.hospital || "Not provided"}</div>
)}
</div>

<div className="profile-form-group">
<label className="profile-form-label">Location</label>
{isEditing ? (
<input
type="text"
name="location"
value={editData.location}
onChange={handleChange}
className="profile-form-input"
/>
) : (
<div className="profile-form-value">{profileData.location || "Not provided"}</div>
)}
</div>

<div className="profile-form-group">
<label className="profile-form-label">Medical License</label>
{isEditing ? (
<input
type="text"
name="license"
value={editData.license}
onChange={handleChange}
className="profile-form-input"
/>
) : (
<div className="profile-form-value">{profileData.license || "Not provided"}</div>
)}
</div>

<div className="profile-form-group">
<label className="profile-form-label">Experience</label>
{isEditing ? (
<input
type="text"
name="experience"
value={editData.experience}
onChange={handleChange}
className="profile-form-input"
/>
) : (
<div className="profile-form-value">{profileData.experience || "Not provided"}</div>
)}
</div>

<div className="profile-form-group full">
<label className="profile-form-label">Education</label>
{isEditing ? (
<input
type="text"
name="education"
value={editData.education}
onChange={handleChange}
className="profile-form-input"
/>
) : (
<div className="profile-form-value">{profileData.education}</div>
)}
</div>

</div>
</div>

<div className="profile-actions-bar">
{isEditing ? (
<>
<button className="btn-cancel" onClick={handleCancel}>
Cancel
</button>
<button className="btn-save" onClick={handleSave}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<polyline points="20 6 9 17 4 12"></polyline>
</svg>
Save Changes
</button>
</>
) : (
<button className="btn-edit" onClick={handleEdit}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
</svg>
Edit Profile
</button>
)}
</div>

</div>

<div>
<div className="profile-sidebar-card" style={{ marginBottom: '24px' }}>
<h3>Recent Activity</h3>
<div>
{recentActivity.map((activity, index) => (
<div key={index} className="profile-activity-item">
<div className="activity-icon">
{activity.icon}
</div>
<div className="activity-content">
<h4>{activity.title}</h4>
<p>{activity.description} • {activity.time}</p>
</div>
</div>
))}
</div>
</div>

<div className="profile-sidebar-card">
<h3>Quick Settings</h3>
<div className="profile-settings-list">
<div className="setting-item" onClick={() => setShowPasswordModal(true)}>
<div className="setting-item-left">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
</svg>
<span>Change Password</span>
</div>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<polyline points="9 18 15 12 9 6"></polyline>
</svg>
</div>
<div className="setting-item" onClick={() => setShowNotificationSettings(true)}>
<div className="setting-item-left">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
</svg>
<span>Notifications</span>
</div>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<polyline points="9 18 15 12 9 6"></polyline>
</svg>
</div>
<div className="setting-item" onClick={() => setShowPreferences(true)}>
<div className="setting-item-left">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<circle cx="12" cy="12" r="3"></circle>
<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
</svg>
<span>Preferences</span>
</div>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<polyline points="9 18 15 12 9 6"></polyline>
</svg>
</div>
</div>
</div>

</div>

</div>

</div>

</div>

</div>

</div>

{showCropper && tempImage && (
<ImageCropper
imageSrc={tempImage}
onCropComplete={handleCropComplete}
onCancel={handleCropCancel}
/>
)}

{showPasswordModal && (
<ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
)}

{showNotificationSettings && (
<NotificationSettings onClose={() => setShowNotificationSettings(false)} />
)}

{showPreferences && (
<PreferencesModal onClose={() => setShowPreferences(false)} />
)}

</>

);

}

export default Profile;
