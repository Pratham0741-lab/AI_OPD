import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { logout } from "../utils/auth";
import { getProfilePicture } from "../utils/avatar";
import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead, deleteNotification } from "../services/api";
import "../styles/global.css";

function Navbar({ profilePicture, pageTitle, refreshTrigger }){

const navigate = useNavigate();
const location = useLocation();
const [showNotifications, setShowNotifications] = useState(false);
const [showProfileMenu, setShowProfileMenu] = useState(false);
const notificationRef = useRef(null);
const profileRef = useRef(null);
const [doctorName, setDoctorName] = useState("Doctor");
const [notifications, setNotifications] = useState([]);
const [loading, setLoading] = useState(false);
const [displayPicture, setDisplayPicture] = useState(null);

// Load doctor name and generate default avatar
useEffect(() => {
const savedDoctor = localStorage.getItem('doctor');
const savedPicture = localStorage.getItem('profilePicture');
if (savedDoctor) {
  const doctor = JSON.parse(savedDoctor);
  const name = doctor.name || "Doctor";
  setDoctorName(name);
  
  // Set display picture (custom or default avatar)
  // Use savedPicture from localStorage to ensure it's always in sync
  setDisplayPicture(getProfilePicture(savedPicture, name));
}
}, [profilePicture]);

// Load notifications from backend
useEffect(() => {
  loadNotifications();
  
  // Refresh notifications every 30 seconds
  const interval = setInterval(loadNotifications, 30000);
  
  return () => clearInterval(interval);
}, [refreshTrigger]);

const loadNotifications = async () => {
  try {
    const result = await getNotifications();
    if (result.success) {
      // Format time for display
      const formattedNotifications = result.notifications.map(notif => ({
        ...notif,
        time: formatTime(notif.time)
      }));
      setNotifications(formattedNotifications);
    }
  } catch (error) {
    console.error("Error loading notifications:", error);
  }
};

const formatTime = (timestamp) => {
  const now = new Date();
  const notifTime = new Date(timestamp);
  const diffMs = now - notifTime;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return notifTime.toLocaleDateString();
};

const unreadCount = notifications.filter(n => n.unread).length;

const markAllAsRead = async () => {
  setLoading(true);
  try {
    const result = await markAllNotificationsAsRead();
    if (result.success) {
      setNotifications(notifications.map(n => ({ ...n, unread: false })));
    }
  } catch (error) {
    console.error("Error marking notifications as read:", error);
  } finally {
    setLoading(false);
  }
};

const handleMarkAsRead = async (id, e) => {
  e.stopPropagation();
  try {
    const result = await markNotificationAsRead(id);
    if (result.success) {
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, unread: false } : n
      ));
    }
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
};

const handleDelete = async (id, e) => {
  e.stopPropagation();
  try {
    const result = await deleteNotification(id);
    if (result.success) {
      setNotifications(notifications.filter(n => n.id !== id));
    }
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
};

const toggleNotifications = () => {
setShowNotifications(!showNotifications);
setShowProfileMenu(false);
};

const toggleProfileMenu = () => {
setShowProfileMenu(!showProfileMenu);
setShowNotifications(false);
};

const handleLogout = () => {
  logout(); // This will clear token and redirect to login
};

const handleProfile = () => {
navigate("/profile");
setShowProfileMenu(false);
};

// Close dropdowns when clicking outside
useEffect(() => {
const handleClickOutside = (event) => {
if (notificationRef.current && !notificationRef.current.contains(event.target)) {
setShowNotifications(false);
}
if (profileRef.current && !profileRef.current.contains(event.target)) {
setShowProfileMenu(false);
}
};

if (showNotifications || showProfileMenu) {
document.addEventListener("mousedown", handleClickOutside);
}

return () => {
document.removeEventListener("mousedown", handleClickOutside);
};
}, [showNotifications, showProfileMenu]);

return(

<div className="navbar">

<div className="navbar-left">
<h2 className="page-title">{pageTitle || "Dashboard"}</h2>
</div>

<div className="navbar-right">

<div className="notification-wrapper" ref={notificationRef}>
<button className="notification-btn" onClick={toggleNotifications}>
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
</svg>
{unreadCount > 0 && (
<span className="notification-badge">{unreadCount}</span>
)}
</button>

{showNotifications && (
<div className="notification-dropdown">
<div className="notification-header">
<h3>Notifications</h3>
{unreadCount > 0 && (
<button 
  className="mark-read-btn" 
  onClick={markAllAsRead}
  disabled={loading}
>
  {loading ? "Marking..." : "Mark all as read"}
</button>
)}
</div>

{notifications.length > 0 ? (
notifications.map(notif => (
<div
key={notif.id}
className={`notification-item ${notif.unread ? 'unread' : ''}`}
>
{notif.unread && <span className="unread-badge"></span>}
<div className="notification-content">
  <p>{notif.message}</p>
  <span className="notification-time">{notif.time}</span>
</div>
<div className="notification-actions">
  {notif.unread && (
    <button 
      className="notification-action-btn" 
      onClick={(e) => handleMarkAsRead(notif.id, e)}
      title="Mark as read"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </button>
  )}
  <button 
    className="notification-action-btn delete" 
    onClick={(e) => handleDelete(notif.id, e)}
    title="Delete"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  </button>
</div>
</div>
))
) : (
<div className="no-notifications">
<p>No notifications</p>
</div>
)}
</div>
)}
</div>

<div className="profile-wrapper" ref={profileRef}>
<div className="doctor-profile" onClick={toggleProfileMenu}>
<img
src={displayPicture}
alt="doctor"
/>
<span>{doctorName}</span>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<polyline points="6 9 12 15 18 9"></polyline>
</svg>
</div>

{showProfileMenu && (
<div className="profile-dropdown">
<div className="profile-menu-item" onClick={handleProfile}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
<circle cx="12" cy="7" r="4"></circle>
</svg>
<span>My Profile</span>
</div>
<div className="profile-menu-divider"></div>
<div className="profile-menu-item logout" onClick={handleLogout}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
<polyline points="16 17 21 12 16 7"></polyline>
<line x1="21" y1="12" x2="9" y2="12"></line>
</svg>
<span>Logout</span>
</div>
</div>
)}
</div>

</div>

</div>

);

}

export default Navbar;
