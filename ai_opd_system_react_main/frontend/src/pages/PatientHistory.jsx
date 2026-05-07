import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { getConsultations } from "../services/api";
import "../styles/global.css";
import "../styles/medical-colors.css";

function PatientHistory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [profilePicture, setProfilePicture] = useState("https://i.pravatar.cc/40");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedPicture = localStorage.getItem('profilePicture');
    if (savedPicture) {
      setProfilePicture(savedPicture);
    }
    loadPatientData();
  }, []);

  const loadPatientData = async () => {
    setLoading(true);
    try {
      const data = await getConsultations();
      const consultationsArray = Array.isArray(data) ? data : [];
      const formattedData = consultationsArray.map(item => ({
        id: item.id,
        date: item.date || item.createdAt || "N/A",
        name: item.patient || "Unknown",
        symptoms: item.symptoms || "N/A",
        diagnosis: item.diagnosis || "Pending",
        age: item.age || "N/A",
        gender: item.gender || "N/A"
      }));
      setPatients(formattedData);
    } catch (error) {
      console.error("Error loading patient data:", error);
      setPatients([]);
    }
    setLoading(false);
  };

  const filteredHistory = Array.isArray(patients) ? patients.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.symptoms.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-main">
        <Navbar profilePicture={profilePicture} pageTitle="Patient History" />
        <div className="dashboard-content">
          <h2>Patient History</h2>
          <div style={{ marginBottom: "20px" }}>
            <input
              type="text"
              placeholder="Search by patient name, diagnosis, or symptoms..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: "100%", maxWidth: "500px" }}
            />
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
              <div style={{ fontSize: "18px", marginBottom: "10px" }}>Loading...</div>
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient Name</th>
                  <th>Age/Gender</th>
                  <th>Symptoms</th>
                  <th>Diagnosis</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((item, index) => (
                    <tr key={item.id || index}>
                      <td>{item.date ? new Date(item.date).toLocaleDateString() : item.date}</td>
                      <td>{item.name}</td>
                      <td>{item.age} / {item.gender}</td>
                      <td>{item.symptoms}</td>
                      <td>{item.diagnosis}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: "40px" }}>
                      No patient records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientHistory;
