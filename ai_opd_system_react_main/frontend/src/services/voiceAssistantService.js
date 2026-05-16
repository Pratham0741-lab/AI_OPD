/**
 * Voice Assistant Service
 * Connects the React OPD frontend to the Python VA backend (port 8000)
 * for GPU-accelerated consultation transcription and Twilio phone calls.
 */

const VA_BASE_URL = process.env.REACT_APP_VA_URL || "http://localhost:8000";

/**
 * Transcribe consultation audio using GPU ASR (IndicConformer + Whisper).
 * Used by AudioRecorder in "GPU ASR" mode.
 */
export const transcribeWithGPU = async (audioBlob, language = "auto") => {
  const formData = new FormData();
  formData.append("audio_file", audioBlob, "recording.webm");
  formData.append("language", language);

  const response = await fetch(
    `${VA_BASE_URL}/api/va/transcribe-consultation`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `GPU ASR failed (${response.status})`);
  }

  return response.json();
};

// ──────────────────────────────────────────────────────────────
// Twilio Phone Call API
// ──────────────────────────────────────────────────────────────

/**
 * Check if Twilio is configured and connected on the backend.
 */
export const checkTwilioConfig = async () => {
  try {
    const response = await fetch(`${VA_BASE_URL}/api/twilio/config`, {
      signal: AbortSignal.timeout(15000),
    });
    return await response.json();
  } catch (error) {
    console.warn("Twilio config check failed:", error.message);
    return { configured: false, connected: false, message: error.message };
  }
};

/**
 * Initiate an outbound Twilio phone call to a patient.
 * @param {string} phoneNumber - E.164 phone number (e.g. +919876543210)
 * @param {string|number} patientId - Patient ID from the OPD system
 * @param {string} patientName - Patient display name
 * @param {number} questionId - Index into HEALTH_QUESTIONS array
 */
export const initiatePhoneCall = async (phoneNumber, patientId, patientName, questionId = 0, language = "en") => {
  const response = await fetch(`${VA_BASE_URL}/api/twilio/initiate-call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone_number: phoneNumber,
      patient_id: patientId,
      patient_name: patientName,
      question_id: questionId,
      language: language,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to initiate call (${response.status})`);
  }

  return response.json();
};

/**
 * Poll for the current status and results of a Twilio call.
 * @param {number} callLogId - The call_log_id returned by initiatePhoneCall
 */
export const getTwilioCallStatus = async (callLogId) => {
  const response = await fetch(`${VA_BASE_URL}/api/twilio/call-status/${callLogId}`, {
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Failed to get call status (${response.status})`);
  }

  return response.json();
};

/**
 * Fetch recent Twilio call logs for display in the history panel.
 * @param {number} limit - Max number of logs to return
 */
export const getTwilioCallLogs = async (limit = 20) => {
  try {
    const response = await fetch(`${VA_BASE_URL}/api/twilio/call-logs?limit=${limit}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch call logs (${response.status})`);
    }
    const data = await response.json();
    return data.logs || [];
  } catch (error) {
    console.warn("Failed to load Twilio call logs:", error.message);
    return [];
  }
};

// ──────────────────────────────────────────────────────────────
// Call Scheduler API
// ──────────────────────────────────────────────────────────────

/**
 * Schedule a call for a specific date/time (flexible to the minute).
 * @param {Object} params - { phone_number, patient_id, patient_name, question_id, scheduled_time (ISO), recurrence, notes }
 */
export const scheduleCall = async (params) => {
  const response = await fetch(`${VA_BASE_URL}/api/twilio/schedule-call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to schedule call (${response.status})`);
  }

  return response.json();
};

/**
 * Get all scheduled calls, optionally filtered by status.
 * @param {string} status - Optional: "pending", "completed", "failed", "cancelled"
 */
export const getScheduledCalls = async (status = null) => {
  try {
    const url = status
      ? `${VA_BASE_URL}/api/twilio/scheduled-calls?status=${status}`
      : `${VA_BASE_URL}/api/twilio/scheduled-calls`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch scheduled calls (${response.status})`);
    }
    const data = await response.json();
    return data.scheduled_calls || [];
  } catch (error) {
    console.warn("Failed to load scheduled calls:", error.message);
    return [];
  }
};

/**
 * Cancel a pending scheduled call.
 * @param {number} callId - The scheduled call ID
 */
export const cancelScheduledCall = async (callId) => {
  const response = await fetch(`${VA_BASE_URL}/api/twilio/scheduled-calls/${callId}/cancel`, {
    method: "PUT",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to cancel scheduled call (${response.status})`);
  }

  return response.json();
};

/**
 * Update a pending scheduled call.
 * @param {number} callId - The scheduled call ID
 * @param {Object} updates - Fields to update (scheduled_time, question_id, recurrence, notes, phone_number)
 */
export const updateScheduledCall = async (callId, updates) => {
  const response = await fetch(`${VA_BASE_URL}/api/twilio/scheduled-calls/${callId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to update scheduled call (${response.status})`);
  }

  return response.json();
};

/**
 * Delete a scheduled call permanently.
 * @param {number} callId - The scheduled call ID
 */
export const deleteScheduledCall = async (callId) => {
  const response = await fetch(`${VA_BASE_URL}/api/twilio/scheduled-calls/${callId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to delete scheduled call (${response.status})`);
  }

  return response.json();
};
