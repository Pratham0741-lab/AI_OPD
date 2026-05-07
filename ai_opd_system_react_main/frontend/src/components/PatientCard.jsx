import React from "react";
import "../styles/global.css";

function PatientCard({ patient }) {
  
  return (
    <div className="patient-card">
      
      <div className="patient-card-header">
        <div className="patient-avatar">
          {patient.name.charAt(0).toUpperCase()}
        </div>
        <div className="patient-info">
          <h3>{patient.name}</h3>
          <p>{patient.age} years • {patient.gender}</p>
        </div>
      </div>

      <div className="patient-card-body">
        
        <div className="patient-detail">
          <label>Last Visit:</label>
          <span>{patient.lastVisit || "N/A"}</span>
        </div>

        <div className="patient-detail">
          <label>Diagnosis:</label>
          <span>{patient.diagnosis || "N/A"}</span>
        </div>

        <div className="patient-detail">
          <label>Contact:</label>
          <span>{patient.contact || "N/A"}</span>
        </div>

      </div>

      <div className="patient-card-footer">
        <button className="view-btn">View Details</button>
        <button className="edit-btn">Edit</button>
      </div>

    </div>
  );
}

export default PatientCard;
