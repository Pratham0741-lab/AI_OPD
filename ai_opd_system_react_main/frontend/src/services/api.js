// ── Base URL (configurable via environment variable for deployment) ──
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    "Authorization": token ? `Bearer ${token}` : ""
  };
};

// Handle 401/403 auth errors by redirecting to login
const handleAuthError = (response) => {
  if (response.status === 401 || response.status === 403) {
    console.warn("Auth error, redirecting to login...");
    localStorage.removeItem("token");
    localStorage.removeItem("doctor");
    window.location.href = "/";
  }
};

export const saveConsultation = async (data) => {
  try {
    const response = await fetch(`${API_BASE}/api/consultation`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    const result = await response.json();
    console.log("saveConsultation response:", response.status, result);
    if (!response.ok || result.success === false) {
      handleAuthError(response);
      throw new Error(result.message || `Save failed (HTTP ${response.status})`);
    }
    return result;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error("Cannot connect to backend server. Is it running?");
    }
    throw error;
  }
};

export const getConsultations = async () => {
  const response = await fetch(`${API_BASE}/api/history`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    console.error(`Failed to fetch consultations: HTTP ${response.status}`);
    return [];
  }
  return response.json();
};

export const getConsultationById = async (id) => {
  const response = await fetch(`${API_BASE}/api/consultation/${id}`, {
    headers: getAuthHeaders()
  });
  return response.json();
};

export const generateReport = async (id) => {
  const response = await fetch(`${API_BASE}/api/report/${id}`, {
    headers: getAuthHeaders()
  });
  return response.json();
};

export const getAllReports = async () => {
  const response = await fetch(`${API_BASE}/api/reports`, {
    headers: getAuthHeaders()
  });
  return response.json();
};

// AI Report Generation
export const generateAIReport = async (transcript, patientInfo) => {
  const response = await fetch(`${API_BASE}/api/ai-report`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ transcript, patientInfo })
  });
  return response.json();
};

export const updateConsultationWithAIReport = async (id, reportData) => {
  const response = await fetch(`${API_BASE}/api/consultation/${id}/ai-report`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(reportData)
  });
  return response.json();
};

// ASR (Speech-to-Text) API
export const transcribeAudio = async (audioBlob, language = 'english') => {
  const token = localStorage.getItem("token");
  
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');
  formData.append('language', language);
  
  const response = await fetch(`${API_BASE}/api/transcribe`, {
    method: "POST",
    headers: {
      "Authorization": token ? `Bearer ${token}` : ""
      // Don't set Content-Type for FormData, browser will set it with boundary
    },
    body: formData
  });
  
  return response.json();
};

// GPU ASR Transcription (via Python Voice Assistant backend)
export const transcribeWithGPU = async (audioBlob, language = 'auto') => {
  const VA_BASE = process.env.REACT_APP_VA_URL || "http://localhost:8000";
  const formData = new FormData();
  formData.append('audio_file', audioBlob, 'recording.webm');
  formData.append('language', language);
  
  const response = await fetch(`${VA_BASE}/api/va/transcribe-consultation`, {
    method: "POST",
    body: formData
  });
  
  return response.json();
};

// Translation API
export const translateText = async (text, targetLanguage) => {
  const response = await fetch(`${API_BASE}/api/translate`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ text, targetLanguage })
  });
  return response.json();
};

export const translateConsultation = async (consultation, targetLanguage) => {
  const response = await fetch(`${API_BASE}/api/translate-consultation`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ consultation, targetLanguage })
  });
  return response.json();
};

export const detectLanguage = async (text) => {
  const response = await fetch(`${API_BASE}/api/detect-language`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ text })
  });
  return response.json();
};

// Profile API
export const getProfile = async () => {
  const response = await fetch(`${API_BASE}/api/profile`, {
    headers: getAuthHeaders()
  });
  return response.json();
};

export const updateProfile = async (profileData) => {
  const response = await fetch(`${API_BASE}/api/profile`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(profileData)
  });
  return response.json();
};

// Notification API
export const getNotifications = async () => {
  const response = await fetch(`${API_BASE}/api/notifications`, {
    headers: getAuthHeaders()
  });
  return response.json();
};

export const createNotification = async (message) => {
  const response = await fetch(`${API_BASE}/api/notifications`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ message })
  });
  return response.json();
};

export const markNotificationAsRead = async (id) => {
  const response = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
    method: "PUT",
    headers: getAuthHeaders()
  });
  return response.json();
};

export const markAllNotificationsAsRead = async () => {
  const response = await fetch(`${API_BASE}/api/notifications/read-all`, {
    method: "PUT",
    headers: getAuthHeaders()
  });
  return response.json();
};

export const deleteNotification = async (id) => {
  const response = await fetch(`${API_BASE}/api/notifications/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders()
  });
  return response.json();
};

// Appointments API
export const getAppointments = async () => {
  const response = await fetch(`${API_BASE}/api/appointments`, {
    headers: getAuthHeaders()
  });
  return response.json();
};

export const createAppointment = async (appointmentData) => {
  const response = await fetch(`${API_BASE}/api/appointments`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(appointmentData)
  });
  return response.json();
};

export const updateAppointment = async (id, appointmentData) => {
  const response = await fetch(`${API_BASE}/api/appointments/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(appointmentData)
  });
  return response.json();
};

export const deleteAppointment = async (id) => {
  const response = await fetch(`${API_BASE}/api/appointments/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders()
  });
  return response.json();
};