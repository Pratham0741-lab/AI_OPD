import React, { useState, useEffect, useRef, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { getProfilePicture } from "../utils/avatar";
import {
  checkTwilioConfig,
  initiatePhoneCall,
  getTwilioCallStatus,
  getTwilioCallLogs,
  scheduleCall,
  getScheduledCalls,
  cancelScheduledCall,
} from "../services/voiceAssistantService";
import "../styles/global.css";
import "../styles/phone-calls.css";

// Health questions matching backend constants
const HEALTH_QUESTIONS = [
  "Did you take your morning medicine today?",
  "Did you take your afternoon medicine today?",
  "Did you take your night medicine today?",
  "Have you checked your blood pressure today?",
  "Have you checked your blood sugar today?",
  "Are you feeling any pain or discomfort?",
];

// 11 Indian languages supported
const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi (हिन्दी)" },
  { code: "kn", name: "Kannada (ಕನ್ನಡ)" },
  { code: "mr", name: "Marathi (मराठी)" },
  { code: "ta", name: "Tamil (தமிழ்)" },
  { code: "te", name: "Telugu (తెలుగు)" },
  { code: "bn", name: "Bengali (বাংলা)" },
  { code: "ml", name: "Malayalam (മലയാളം)" },
  { code: "gu", name: "Gujarati (ગુજરાતી)" },
  { code: "pa", name: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "or", name: "Odia (ଓଡ଼ିଆ)" },
];

const WEEKDAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function PhoneCalls() {
  const [profilePicture, setProfilePicture] = useState(null);
  const [activeTab, setActiveTab] = useState("call"); // "call", "logs", or "scheduler"

  // Twilio config state
  const [twilioStatus, setTwilioStatus] = useState("checking"); // checking, connected, error
  const [twilioMessage, setTwilioMessage] = useState("Checking Twilio configuration...");

  // Call form state
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [questionId, setQuestionId] = useState(0);
  const [language, setLanguage] = useState("en");
  const [isPlacingCall, setIsPlacingCall] = useState(false);

  // Active call state
  const [activeCall, setActiveCall] = useState(null);
  const pollTimerRef = useRef(null);

  // Call logs
  const [callLogs, setCallLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Scheduler state
  const [schedPatient, setSchedPatient] = useState("");
  const [schedPhone, setSchedPhone] = useState("");
  const [schedQuestion, setSchedQuestion] = useState(0);
  const [schedLanguage, setSchedLanguage] = useState("en");
  const [schedTime, setSchedTime] = useState("09:00");
  const [schedStartDate, setSchedStartDate] = useState("");
  const [schedEndDate, setSchedEndDate] = useState("");
  const [schedRecurrence, setSchedRecurrence] = useState("daily");
  const [schedWeekdays, setSchedWeekdays] = useState(["mon","tue","wed","thu","fri"]);
  const [schedNotes, setSchedNotes] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledCalls, setScheduledCalls] = useState([]);
  const [schedLoading, setSchedLoading] = useState(false);

  // Load profile picture
  useEffect(() => {
    const savedPicture = localStorage.getItem("profilePicture");
    const savedDoctor = localStorage.getItem("doctor");
    const name = savedDoctor ? JSON.parse(savedDoctor).name : "Doctor";
    setProfilePicture(getProfilePicture(savedPicture, name));
  }, []);

  // Check Twilio config on mount
  useEffect(() => {
    loadTwilioConfig();
    loadPatients();
    loadCallLogs();
  }, []);

  // Cleanup poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const loadTwilioConfig = async () => {
    setTwilioStatus("checking");
    setTwilioMessage("Checking Twilio configuration...");
    try {
      const config = await checkTwilioConfig();
      if (config.configured && config.connected) {
        setTwilioStatus("connected");
        setTwilioMessage(config.message || "Twilio is connected and ready.");
      } else if (config.configured) {
        setTwilioStatus("error");
        setTwilioMessage(config.message || "Twilio configured but connection failed.");
      } else {
        setTwilioStatus("error");
        setTwilioMessage(
          config.message ||
            "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env"
        );
      }
    } catch {
      setTwilioStatus("error");
      setTwilioMessage("Cannot reach backend. Make sure the Python server is running on port 8000.");
    }
  };

  const loadPatients = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/patients");
      const data = await res.json();
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load patients:", err);
    }
  };

  const loadCallLogs = async () => {
    setLogsLoading(true);
    try {
      const logs = await getTwilioCallLogs(30);
      setCallLogs(logs);
    } catch (err) {
      console.error("Failed to load call logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handlePatientChange = (e) => {
    const val = e.target.value;
    setSelectedPatient(val);
    if (val) {
      try {
        const patient = JSON.parse(val);
        if (patient.phone) setPhoneNumber(patient.phone);
      } catch {}
    }
  };

  const handlePlaceCall = async (e) => {
    e.preventDefault();

    if (twilioStatus !== "connected") {
      alert("Twilio is not connected. Please check your configuration.");
      return;
    }

    if (!phoneNumber.trim()) {
      alert("Please enter a phone number.");
      return;
    }

    let patientId = null;
    let patientName = "Patient";
    if (selectedPatient) {
      try {
        const p = JSON.parse(selectedPatient);
        patientId = p.id;
        patientName = p.name;
      } catch {}
    }

    setIsPlacingCall(true);

    try {
      const result = await initiatePhoneCall(phoneNumber, patientId, patientName, questionId, language);

      // Set active call
      setActiveCall({
        callLogId: result.call_log_id,
        phoneNumber: result.phone_number || phoneNumber,
        question: result.question || HEALTH_QUESTIONS[questionId],
        status: result.status || "initiated",
        patientName: patientName,
        transcript: null,
        intent: null,
        detectedLanguage: null,
        responseText: null,
      });

      // Start polling
      startPolling(result.call_log_id);

      // Refresh logs
      loadCallLogs();
    } catch (err) {
      alert("Failed to place call: " + err.message);
    } finally {
      setIsPlacingCall(false);
    }
  };

  const startPolling = useCallback((callLogId) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const data = await getTwilioCallStatus(callLogId);

        setActiveCall((prev) => ({
          ...prev,
          status: data.status,
          transcript: data.transcript || prev?.transcript,
          intent: data.intent || prev?.intent,
          detectedLanguage: data.detected_language_name || data.detected_language || prev?.detectedLanguage,
          responseText: data.response_text || prev?.responseText,
        }));

        const terminalStatuses = ["completed", "failed", "busy", "no-answer", "canceled"];
        if (terminalStatuses.includes(data.status)) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          loadCallLogs();
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 3000);
  }, []);

  const formatTime = (isoString) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString();
  };

  const truncate = (text, maxLen = 30) => {
    if (!text) return "—";
    return text.length > maxLen ? text.substring(0, maxLen) + "..." : text;
  };

  // ── Scheduler handlers ──
  const loadScheduledCalls = async () => {
    setSchedLoading(true);
    try {
      const calls = await getScheduledCalls();
      setScheduledCalls(calls);
    } catch (err) {
      console.warn("Failed to load scheduled calls:", err);
    }
    setSchedLoading(false);
  };

  const handleSchedPatientChange = (e) => {
    const pid = e.target.value;
    setSchedPatient(pid);
    if (pid) {
      const p = patients.find((pt) => String(pt.id) === pid);
      if (p && p.phone) setSchedPhone(p.phone);
    } else {
      setSchedPhone("");
    }
  };

  const toggleWeekday = (day) => {
    setSchedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!schedPhone || !schedStartDate || !schedTime) return;
    setIsScheduling(true);
    try {
      const scheduledTime = `${schedStartDate}T${schedTime}`;
      const patient = patients.find((p) => String(p.id) === schedPatient);
      await scheduleCall({
        phone_number: schedPhone,
        patient_id: schedPatient || null,
        patient_name: patient ? patient.name : "Patient",
        question_id: schedQuestion,
        scheduled_time: scheduledTime,
        end_date: schedEndDate ? `${schedEndDate}T${schedTime}` : "",
        recurrence: schedRecurrence,
        weekdays: schedRecurrence === "custom" ? schedWeekdays.join(",") : "",
        language: schedLanguage,
        notes: schedNotes,
      });
      alert("✅ Call scheduled successfully!");
      setSchedNotes("");
      loadScheduledCalls();
    } catch (err) {
      alert("❌ Failed to schedule: " + err.message);
    }
    setIsScheduling(false);
  };

  const handleCancelSchedule = async (id) => {
    if (!window.confirm("Cancel this scheduled call?")) return;
    try {
      await cancelScheduledCall(id);
      loadScheduledCalls();
    } catch (err) {
      alert("Failed to cancel: " + err.message);
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-main">
        <Navbar profilePicture={profilePicture} pageTitle="Phone Calls" />
        <div className="dashboard-content phone-calls-page">
          {/* Twilio Status Banner */}
          <div className={`twilio-banner ${twilioStatus}`}>
            <span className="banner-icon">
              {twilioStatus === "connected" && "✅"}
              {twilioStatus === "error" && "⚠️"}
              {twilioStatus === "checking" && "⏳"}
            </span>
            <div className="banner-text">
              <h4>
                {twilioStatus === "connected" && "Twilio Connected"}
                {twilioStatus === "error" && "Twilio Not Available"}
                {twilioStatus === "checking" && "Checking Twilio..."}
              </h4>
              <p>{twilioMessage}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="phone-tabs">
            <button
              className={`phone-tab ${activeTab === "call" ? "active" : ""}`}
              onClick={() => setActiveTab("call")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Place Call
            </button>
            <button
              className={`phone-tab ${activeTab === "logs" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("logs");
                loadCallLogs();
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Call Logs
            </button>
            <button
              className={`phone-tab ${activeTab === "scheduler" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("scheduler");
                loadScheduledCalls();
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Scheduler
            </button>
          </div>

          {/* Tab: Place Call */}
          {activeTab === "call" && (
            <>
              <div className="call-form-card">
                <h3>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Initiate Health-Check Call
                </h3>

                <form className="call-form-grid" onSubmit={handlePlaceCall}>
                  <div className="form-group">
                    <label htmlFor="callPatient">Patient</label>
                    <select
                      id="callPatient"
                      value={selectedPatient}
                      onChange={handlePatientChange}
                    >
                      <option value="">— Select Patient —</option>
                      {patients.map((p) => (
                        <option
                          key={p.id}
                          value={JSON.stringify({ id: p.id, name: p.name, phone: p.phone || "" })}
                        >
                          {p.name} (ID: {p.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="callPhone">Phone Number (E.164)</label>
                    <input
                      id="callPhone"
                      type="tel"
                      placeholder="+91XXXXXXXXXX"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="callQuestion">Health Question</label>
                    <select
                      id="callQuestion"
                      value={questionId}
                      onChange={(e) => setQuestionId(parseInt(e.target.value))}
                    >
                      {HEALTH_QUESTIONS.map((q, i) => (
                        <option key={i} value={i}>
                          {q}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="callLanguage">Patient's Language 🌐</label>
                    <select
                      id="callLanguage"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className={`place-call-btn ${isPlacingCall ? "calling" : ""}`}
                    disabled={twilioStatus !== "connected" || isPlacingCall}
                  >
                    {isPlacingCall ? (
                      <>⏳ Placing Call...</>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        Place Call
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Active Call Card */}
              {activeCall && (
                <div className="active-call-card">
                  <h3>
                    <span className="pulse-dot"></span>
                    Active Call — {activeCall.patientName}
                  </h3>
                  <div className="call-info-grid">
                    <div className="call-info-item">
                      <span className="label">Status</span>
                      <span className={`status-badge ${activeCall.status}`}>
                        {activeCall.status}
                      </span>
                    </div>
                    <div className="call-info-item">
                      <span className="label">Phone</span>
                      <span className="value">{activeCall.phoneNumber}</span>
                    </div>
                    <div className="call-info-item">
                      <span className="label">Question</span>
                      <span className="value">{truncate(activeCall.question, 50)}</span>
                    </div>
                  </div>

                  {activeCall.transcript && (
                    <div className="call-result-section">
                      <div className="call-info-grid">
                        <div className="call-info-item">
                          <span className="label">Transcript</span>
                          <span className="value">{activeCall.transcript}</span>
                        </div>
                        <div className="call-info-item">
                          <span className="label">Intent</span>
                          <span className={`intent-badge ${(activeCall.intent || "").toLowerCase()}`}>
                            {activeCall.intent || "—"}
                          </span>
                        </div>
                        <div className="call-info-item">
                          <span className="label">Language</span>
                          <span className="value">{activeCall.detectedLanguage || "—"}</span>
                        </div>
                        {activeCall.responseText && (
                          <div className="call-info-item">
                            <span className="label">Response</span>
                            <span className="value" style={{ color: "#10b981" }}>
                              {activeCall.responseText}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Tab: Call Logs */}
          {activeTab === "logs" && (
            <div className="call-logs-card">
              <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Recent Call History
              </h3>

              {logsLoading ? (
                <div className="empty-state">
                  <p>Loading call logs...</p>
                </div>
              ) : callLogs.length === 0 ? (
                <div className="empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72" />
                  </svg>
                  <h4>No call logs yet</h4>
                  <p>Place your first health-check call to get started.</p>
                </div>
              ) : (
                <table className="call-logs-table">
                  <thead>
                    <tr>
                      <th>Phone</th>
                      <th>Patient</th>
                      <th>Question</th>
                      <th>Status</th>
                      <th>Intent</th>
                      <th>Language</th>
                      <th>Transcript</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callLogs.map((log, i) => (
                      <tr key={log.id || i}>
                        <td>{log.phone_number}</td>
                        <td>{log.patient_name || "—"}</td>
                        <td className="truncate" title={log.question || ""}>
                          {truncate(log.question, 25)}
                        </td>
                        <td>
                          <span className={`status-badge ${log.status}`}>{log.status}</span>
                        </td>
                        <td>
                          <span className={`intent-badge ${(log.intent || "").toLowerCase()}`}>
                            {log.intent || "—"}
                          </span>
                        </td>
                        <td>{log.detected_language_name || "—"}</td>
                        <td className="truncate" title={log.transcript || ""}>
                          {truncate(log.transcript, 20)}
                        </td>
                        <td className="time-cell">{formatTime(log.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {/* Tab: Scheduler */}
          {activeTab === "scheduler" && (
            <>
              <div className="call-form-card">
                <h3>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Schedule Medicine Course Calls
                </h3>
                <form onSubmit={handleScheduleSubmit} className="call-form-grid">
                  <div className="form-group">
                    <label>Patient</label>
                    <select value={schedPatient} onChange={handleSchedPatientChange}>
                      <option value="">— Select patient —</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      value={schedPhone}
                      onChange={(e) => setSchedPhone(e.target.value)}
                      placeholder="+91XXXXXXXXXX"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Health Question</label>
                    <select value={schedQuestion} onChange={(e) => setSchedQuestion(parseInt(e.target.value))}>
                      {HEALTH_QUESTIONS.map((q, i) => (
                        <option key={i} value={i}>{q}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Patient's Language 🌐</label>
                    <select value={schedLanguage} onChange={(e) => setSchedLanguage(e.target.value)}>
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Call Time ⏰</label>
                    <input
                      type="time"
                      value={schedTime}
                      onChange={(e) => setSchedTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={schedStartDate}
                      onChange={(e) => setSchedStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input
                      type="date"
                      value={schedEndDate}
                      onChange={(e) => setSchedEndDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Recurrence</label>
                    <select value={schedRecurrence} onChange={(e) => setSchedRecurrence(e.target.value)}>
                      <option value="once">One Time</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="custom">Custom Days</option>
                    </select>
                  </div>
                  {schedRecurrence === "custom" && (
                    <div className="form-group full-width">
                      <label>Select Days</label>
                      <div className="weekday-picker">
                        {WEEKDAYS.map((d) => (
                          <button
                            key={d.key}
                            type="button"
                            className={`weekday-btn ${schedWeekdays.includes(d.key) ? "active" : ""}`}
                            onClick={() => toggleWeekday(d.key)}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="form-group full-width">
                    <label>Notes (optional)</label>
                    <input
                      type="text"
                      value={schedNotes}
                      onChange={(e) => setSchedNotes(e.target.value)}
                      placeholder="e.g. Blood pressure medication — after breakfast"
                    />
                  </div>
                  <button
                    type="submit"
                    className={`place-call-btn ${isScheduling ? "calling" : ""}`}
                    disabled={isScheduling || !schedPhone || !schedStartDate}
                    style={{ gridColumn: "1 / -1" }}
                  >
                    {isScheduling ? "Scheduling..." : "📅 Schedule Course"}
                  </button>
                </form>
              </div>

              {/* Scheduled Calls List */}
              <div className="call-logs-card" style={{ marginTop: "1.2rem" }}>
                <h3>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Scheduled Calls
                </h3>
                {schedLoading ? (
                  <div className="empty-state"><p>Loading...</p></div>
                ) : scheduledCalls.length === 0 ? (
                  <div className="empty-state">
                    <h4>No scheduled calls</h4>
                    <p>Schedule a medicine course above to get started.</p>
                  </div>
                ) : (
                  <table className="call-logs-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Phone</th>
                        <th>Question</th>
                        <th>Time</th>
                        <th>Dates</th>
                        <th>Recurrence</th>
                        <th>Lang</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduledCalls.map((sc) => (
                        <tr key={sc.id}>
                          <td>{sc.patient_name || "—"}</td>
                          <td>{sc.phone_number}</td>
                          <td className="truncate" title={sc.question_text}>
                            {truncate(sc.question_text, 20)}
                          </td>
                          <td>
                            {sc.scheduled_time
                              ? new Date(sc.scheduled_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "—"}
                          </td>
                          <td className="time-cell">
                            {sc.scheduled_time ? new Date(sc.scheduled_time).toLocaleDateString() : "—"}
                            {sc.end_date ? " → " + new Date(sc.end_date).toLocaleDateString() : ""}
                          </td>
                          <td>
                            <span className="status-badge in-progress">
                              {sc.recurrence}{sc.weekdays ? ` (${sc.weekdays})` : ""}
                            </span>
                          </td>
                          <td>{LANGUAGES.find((l) => l.code === sc.language)?.name?.split(" ")[0] || sc.language}</td>
                          <td>
                            <span className={`status-badge ${sc.status}`}>{sc.status}</span>
                          </td>
                          <td>
                            {sc.status === "pending" && (
                              <button
                                className="cancel-btn"
                                onClick={() => handleCancelSchedule(sc.id)}
                                title="Cancel"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PhoneCalls;
