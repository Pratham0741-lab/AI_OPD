import React, { useState, useRef, useEffect } from "react";
import { transcribeAudio, transcribeWithGPU } from "../services/api";

function AudioRecorder({ isRecording, setIsRecording, onTranscriptionUpdate, language }) {

const [audioURL, setAudioURL] = useState("");
const [recordingTime, setRecordingTime] = useState(0);
const [isProcessing, setIsProcessing] = useState(false);
const [transcript, setTranscript] = useState("");
const [interimTranscript, setInterimTranscript] = useState("");
const [isSpeechSupported, setIsSpeechSupported] = useState(true);
const [asrMode, setAsrMode] = useState("gpu"); // "gpu", "backend", or "browser"
const [detectedLanguage, setDetectedLanguage] = useState(null);
const [gpuAvailable, setGpuAvailable] = useState(null);

const mediaRecorderRef = useRef(null);
const audioChunksRef = useRef([]);
const timerRef = useRef(null);
const recognitionRef = useRef(null);

// Check GPU ASR availability on mount
useEffect(() => {
  checkGPUAvailability();
}, []);

const checkGPUAvailability = async () => {
  try {
    const response = await fetch("http://localhost:8000/api/va/health", {
      signal: AbortSignal.timeout(3000),
    });
    const data = await response.json();
    setGpuAvailable(data.status === "ok" && data.models_loaded);
    if (!data.models_loaded) {
      setAsrMode("backend");
    }
  } catch {
    setGpuAvailable(false);
    setAsrMode("backend");
  }
};

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
      if (asrMode === "gpu") {
        await processAudioWithGPU(audioBlob);
      } else if (asrMode === "backend") {
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
    setDetectedLanguage(null);

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

const processAudioWithGPU = async (audioBlob) => {
  setIsProcessing(true);
  
  try {
    console.log("Sending audio to GPU ASR (IndicConformer + Whisper)...");
    
    // Map language name to code for the GPU ASR
    const langMap = {
      english: "en", hindi: "hi", kannada: "kn", marathi: "mr",
      tamil: "ta", telugu: "te", bengali: "bn", malayalam: "ml",
      gujarati: "gu", punjabi: "pa", odia: "or"
    };
    const langCode = langMap[language] || "auto";
    
    const result = await transcribeWithGPU(audioBlob, langCode);
    
    if (result.success && result.transcription) {
      console.log("✓ GPU ASR transcription successful");
      setTranscript(result.transcription);
      onTranscriptionUpdate(result.transcription);
      setDetectedLanguage(result.detected_language_name);
    } else {
      throw new Error("GPU ASR returned empty result");
    }
    
  } catch (error) {
    console.error("GPU ASR error:", error);
    alert(`GPU ASR failed: ${error.message}\n\nFalling back to Whisper ASR.`);
    setAsrMode("backend");
  } finally {
    setIsProcessing(false);
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
        className={`mode-btn ${asrMode === "gpu" ? "active" : ""}`}
        onClick={() => !isRecording && setAsrMode("gpu")}
        disabled={isRecording || !gpuAvailable}
        title={gpuAvailable ? "GPU ASR (IndicConformer + Whisper) - Best accuracy" : "GPU ASR unavailable - start Python backend on port 8000"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
          <rect x="9" y="9" width="6" height="6"></rect>
          <line x1="9" y1="2" x2="9" y2="4"></line>
          <line x1="15" y1="2" x2="15" y2="4"></line>
          <line x1="9" y1="20" x2="9" y2="22"></line>
          <line x1="15" y1="20" x2="15" y2="22"></line>
          <line x1="20" y1="9" x2="22" y2="9"></line>
          <line x1="20" y1="14" x2="22" y2="14"></line>
          <line x1="2" y1="9" x2="4" y2="9"></line>
          <line x1="2" y1="14" x2="4" y2="14"></line>
        </svg>
        GPU ASR
      </button>
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
      {asrMode === "gpu" 
        ? "Using GPU ASR (IndicConformer + Whisper) — 11 languages, highest accuracy" 
        : asrMode === "backend" 
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
      <p>Processing audio with {asrMode === "gpu" ? "GPU ASR (IndicConformer + Whisper)" : "Whisper ASR"}...</p>
      <p className="processing-detail">This may take a few seconds depending on audio length</p>
    </div>
  )}

  {/* Detected Language Badge */}
  {detectedLanguage && !isProcessing && !isRecording && (
    <div className="detected-language-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        <path d="M2 12h20"></path>
      </svg>
      <span>Detected Language: <strong>{detectedLanguage}</strong></span>
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
          <span>Audio recorded and transcribed successfully{asrMode === "gpu" ? " (GPU ASR)" : ""}</span>
        </div>
      )}

    </div>

  )}

</div>

);

}

export default AudioRecorder;
