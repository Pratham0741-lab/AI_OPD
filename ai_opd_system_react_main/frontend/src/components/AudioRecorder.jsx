import React, { useState, useRef, useEffect } from "react";
import { transcribeAudio } from "../services/api";

function AudioRecorder({ isRecording, setIsRecording, onTranscriptionUpdate, language }) {

const [audioURL, setAudioURL] = useState("");
const [recordingTime, setRecordingTime] = useState(0);
const [isProcessing, setIsProcessing] = useState(false);
const [transcript, setTranscript] = useState("");
const [interimTranscript, setInterimTranscript] = useState("");
const [isSpeechSupported, setIsSpeechSupported] = useState(true);
const [asrMode, setAsrMode] = useState("backend"); // "backend" or "browser"

const mediaRecorderRef = useRef(null);
const audioChunksRef = useRef([]);
const timerRef = useRef(null);
const recognitionRef = useRef(null);

useEffect(() => {
  // Check if browser supports speech recognition (fallback)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setIsSpeechSupported(false);
    console.warn("Browser speech recognition not supported");
  }

  // Initialize browser speech recognition as fallback
  if (SpeechRecognition && asrMode === "browser") {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    // Set language based on prop
    const languageMap = {
      english: "en-IN",
      hindi: "hi-IN",
      kannada: "kn-IN",
      marathi: "mr-IN",
      tamil: "ta-IN",
      telugu: "te-IN",
      bengali: "bn-IN",
      malayalam: "ml-IN",
      gujarati: "gu-IN",
      punjabi: "pa-IN",
      odia: "or-IN"
    };
    recognition.lang = languageMap[language] || "en-IN";

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPiece + " ";
        } else {
          interim += transcriptPiece;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech") {
        console.log("No speech detected, continuing...");
      } else if (event.error === "not-allowed") {
        alert("Microphone access denied. Please allow microphone access.");
        stopRecording();
      }
    };

    recognition.onend = () => {
      // Restart if still recording
      if (isRecording && asrMode === "browser") {
        try {
          recognition.start();
        } catch (error) {
          console.log("Recognition restart error:", error);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }
}, [language, asrMode]);

// Update parent component with transcript
useEffect(() => {
  if (transcript) {
    onTranscriptionUpdate(transcript + interimTranscript);
  }
}, [transcript, interimTranscript, onTranscriptionUpdate]);

const startRecording = async () => {

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Start audio recording
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(audioBlob);
      setAudioURL(url);

      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());

      // Process based on ASR mode
      if (asrMode === "backend") {
        await processAudioWithBackendASR(audioBlob);
      }

      audioChunksRef.current = [];
    };

    mediaRecorder.start();

    // Start browser speech recognition if in browser mode
    if (asrMode === "browser" && recognitionRef.current) {
      setTranscript("");
      setInterimTranscript("");
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.log("Recognition already started or error:", error);
      }
    }

    setIsRecording(true);
    setRecordingTime(0);

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

  } catch (error) {
    alert("Microphone access denied. Please allow microphone access to record.");
    console.error("Error accessing microphone:", error);
  }

};

const stopRecording = () => {

  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
    mediaRecorderRef.current.stop();
  }

  // Stop browser speech recognition
  if (recognitionRef.current && asrMode === "browser") {
    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.log("Recognition stop error:", error);
    }
  }

  setIsRecording(false);

  // Stop timer
  if (timerRef.current) {
    clearInterval(timerRef.current);
  }

};

const processAudioWithBackendASR = async (audioBlob) => {
  setIsProcessing(true);
  
  try {
    console.log("Sending audio to backend ASR service...");
    
    const result = await transcribeAudio(audioBlob, language);
    
    if (result.success && result.transcription) {
      console.log("✓ Backend ASR transcription successful");
      setTranscript(result.transcription);
      onTranscriptionUpdate(result.transcription);
    } else {
      throw new Error(result.message || "Transcription failed");
    }
    
  } catch (error) {
    console.error("Backend ASR error:", error);
    alert(`Backend ASR failed: ${error.message}\n\nFalling back to browser speech recognition.`);
    setAsrMode("browser");
  } finally {
    setIsProcessing(false);
  }
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

return (

<div className="audio-recorder-container">

  {/* ASR Mode Toggle */}
  <div className="asr-mode-selector">
    <label>ASR Mode:</label>
    <div className="mode-toggle">
      <button 
        className={`mode-btn ${asrMode === "backend" ? "active" : ""}`}
        onClick={() => !isRecording && setAsrMode("backend")}
        disabled={isRecording}
        title="Use Whisper ASR (Backend) - More accurate"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        Whisper ASR
      </button>
      <button 
        className={`mode-btn ${asrMode === "browser" ? "active" : ""}`}
        onClick={() => !isRecording && setAsrMode("browser")}
        disabled={isRecording || !isSpeechSupported}
        title="Use Browser Speech Recognition - Real-time"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        </svg>
        Browser
      </button>
    </div>
    <span className="mode-description">
      {asrMode === "backend" 
        ? "Using Whisper ASR (transcribes after recording)" 
        : "Using browser speech recognition (real-time)"}
    </span>
  </div>

  <div className="recorder-controls">

    {!isRecording ? (

      <button className="record-btn-large" onClick={startRecording}>
        <div className="record-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
        </div>
        <span>Start Recording</span>
      </button>

    ) : (

      <div className="recording-active-panel">
        <button className="stop-record-btn-large" onClick={stopRecording}>
          <div className="stop-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"></rect>
            </svg>
          </div>
          <span>Stop Recording</span>
        </button>
        <div className="recording-indicator-large">
          <span className="recording-dot-large"></span>
          <span className="recording-time-large">{formatTime(recordingTime)}</span>
          <span className="recording-label">Recording in progress...</span>
        </div>
      </div>

    )}

  </div>

  {isProcessing && (
    <div className="processing-indicator">
      <div className="processing-spinner"></div>
      <p>Processing audio with Whisper ASR...</p>
      <p className="processing-detail">This may take a few seconds depending on audio length</p>
    </div>
  )}

  {isRecording && asrMode === "browser" && transcript && (
    <div className="live-transcript-panel">
      <div className="transcript-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </svg>
        <h4>Live Transcription</h4>
        <span className="live-badge">LIVE</span>
      </div>
      <div className="transcript-content">
        <p>{transcript}</p>
        {interimTranscript && <p className="interim-text">{interimTranscript}</p>}
      </div>
    </div>
  )}

  {audioURL && !isProcessing && (

    <div className="audio-playback-panel">

      <div className="playback-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <h4>Recorded Consultation Audio</h4>
      </div>

      <audio controls src={audioURL}></audio>

      {transcript && (
        <div className="audio-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Audio recorded and transcribed successfully</span>
        </div>
      )}

    </div>

  )}

</div>

);

}

export default AudioRecorder;
