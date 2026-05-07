import React from "react";
import { Link, useLocation } from "react-router-dom";
import "../styles/global.css";

function Sidebar(){

const location = useLocation();

const isActive = (path) => {
return location.pathname === path ? 'active' : '';
};

return(

<div className="sidebar">

<h2 className="sidebar-logo">VocabOPD</h2>

<ul className="sidebar-menu">

<li>
<Link to="/dashboard" className={isActive('/dashboard')}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<rect x="3" y="3" width="7" height="7"></rect>
<rect x="14" y="3" width="7" height="7"></rect>
<rect x="14" y="14" width="7" height="7"></rect>
<rect x="3" y="14" width="7" height="7"></rect>
</svg>
<span>Dashboard</span>
</Link>
</li>

<li>
<Link to="/record" className={isActive('/record')}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<circle cx="12" cy="12" r="10"></circle>
<circle cx="12" cy="12" r="3"></circle>
</svg>
<span>Record Consultation</span>
</Link>
</li>

<li>
<Link to="/patients" className={isActive('/patients')}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
<circle cx="9" cy="7" r="4"></circle>
<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
</svg>
<span>Patient History</span>
</Link>
</li>

<li>
<Link to="/reports" className={isActive('/reports')}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
<polyline points="14 2 14 8 20 8"></polyline>
<line x1="16" y1="13" x2="8" y2="13"></line>
<line x1="16" y1="17" x2="8" y2="17"></line>
<polyline points="10 9 9 9 8 9"></polyline>
</svg>
<span>Reports</span>
</Link>
</li>

<li>
<Link to="/phone-calls" className={isActive('/phone-calls')}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
</svg>
<span>Phone Calls</span>
</Link>
</li>

<li>
<Link to="/profile" className={isActive('/profile')}>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
<circle cx="12" cy="7" r="4"></circle>
</svg>
<span>Profile</span>
</Link>
</li>

</ul>

<div className="sidebar-footer">
<p>&copy; 2026 VocabOPD</p>
<p>AI Medical Assistant</p>
</div>

</div>

);

}

export default Sidebar;
