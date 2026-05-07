import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import AudioRecorder from "../components/AudioRecorder";
import TranscriptionEditor from "../components/TranscriptionEditor";
import { saveConsultation, generateAIReport, translateText, createNotification } from "../services/api";
import "../styles/global.css";
import "../styles/medical-colors.css";
import "../styles/consultation.css";

function RecordConsultation() {

const [profilePicture, setProfilePicture] = useState("https://i.pravatar.cc/40");
const [patientData, setPatientData] = useState({
name: "",
age: "",
gender: "",
symptoms: "",
medicalHistory: ""
});
const [language, setLanguage] = useState("english");
const [isRecording, setIsRecording] = useState(false);
const [transcription, setTranscription] = useState("");
const [aiSummary, setAiSummary] = useState(null);
const [consultationSaved, setConsultationSaved] = useState(false);
const [currentStep, setCurrentStep] = useState(1);
const [isGeneratingAI, setIsGeneratingAI] = useState(false);
const [aiReportText, setAiReportText] = useState("");
const [isTranslating, setIsTranslating] = useState(false);
const [translatedText, setTranslatedText] = useState("");

useEffect(() => {
const savedPicture = localStorage.getItem('profilePicture');
if (savedPicture) {
setProfilePicture(savedPicture);
}
}, []);

const handleInputChange = (e) => {
setPatientData({
...patientData,
[e.target.name]: e.target.value
});
};

const handleNextStep = () => {
if (currentStep === 1) {
if (!patientData.name || !patientData.age || !patientData.gender) {
alert("Please fill in all required patient information");
return;
}
}
setCurrentStep(currentStep + 1);
};

const handlePreviousStep = () => {
setCurrentStep(currentStep - 1);
};

const generateAISummary = async (text) => {
  if (!text || text.trim().length < 50) {
    alert("Please provide a longer transcript for AI analysis");
    return;
  }

  setIsGeneratingAI(true);

  try {
    const patientInfo = {
      patient: patientData.name,
      age: patientData.age,
      gender: patientData.gender
    };

    const result = await generateAIReport(text, patientInfo);

    if (result.success) {
      setAiReportText(result.report);
      
      // Use structured entities if available
      if (result.entities) {
        console.log("Received structured entities:", result.entities);
        
        setAiSummary({
          chiefComplaint: result.entities.chiefComplaint || "Not clearly stated in transcript",
          symptoms: Array.isArray(result.entities.symptoms) 
            ? result.entities.symptoms 
            : (result.entities.symptoms ? [result.entities.symptoms] : ["As described in consultation"]),
          diagnosis: result.entities.diagnosis || "To be determined based on examination",
          prescription: result.entities.prescription || "Prescription provided during consultation",
          advice: Array.isArray(result.entities.medicalAdvice) 
            ? result.entities.medicalAdvice.join(". ") + "."
            : (result.entities.medicalAdvice || "Follow medical advice and return if symptoms persist")
        });
      } else {
        // Fallback to local extraction
        console.log("No structured entities, using local extraction");
        setAiSummary({
          chiefComplaint: extractChiefComplaint(text),
          symptoms: [extractSymptoms(text)],
          diagnosis: extractDiagnosis(text),
          prescription: extractPrescription(text),
          advice: extractAdvice(text)
        });
      }

      // Create notification for AI report generation
      await createNotification(`AI medical report generated for ${patientData.name}`);

      // Show success message with better UX
      const successMessage = document.createElement('div');
      successMessage.className = 'ai-success-toast';
      successMessage.innerHTML = `
        <div class="toast-icon">✓</div>
        <div class="toast-content">
          <strong>AI Analysis Complete!</strong>
          <p>Medical report generated successfully</p>
        </div>
      `;
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        successMessage.remove();
      }, 4000);
    } else {
      throw new Error(result.message || "AI generation failed");
    }
  } catch (error) {
    console.error("AI Report Error:", error);
    alert("AI report generation failed. Using local analysis instead.");
    
    // Fallback to local processing
    const summary = {
      chiefComplaint: extractChiefComplaint(text),
      symptoms: [extractSymptoms(text)],
      diagnosis: extractDiagnosis(text),
      prescription: extractPrescription(text),
      advice: extractAdvice(text)
    };
    setAiSummary(summary);
  } finally {
    setIsGeneratingAI(false);
  }
};

const extractChiefComplaint = (text) => {
  const lowerText = text.toLowerCase();
  
  // Look for patient's first statement after greeting
  const patientStatements = text.match(/patient[^:]*:[^.]*?([^.?!]+[.?!])/i);
  if (patientStatements && patientStatements[1]) {
    const statement = patientStatements[1].trim();
    // Remove common filler words
    const cleaned = statement
      .replace(/^(hi|hello|good morning|good afternoon|well|um|uh)[,\s]*/i, '')
      .replace(/^(i've been|i have been|i'm|i am)[,\s]*/i, '')
      .trim();
    if (cleaned.length > 10 && cleaned.length < 100) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }
  
  // Look for "dealing with" or "having" patterns
  const dealingWith = text.match(/(?:dealing with|having|experiencing)\s+(?:a\s+)?([^.]+?)(?:\.|for)/i);
  if (dealingWith && dealingWith[1]) {
    return dealingWith[1].trim().charAt(0).toUpperCase() + dealingWith[1].trim().slice(1);
  }
  
  // Fallback: look for first mentioned symptom
  const symptoms = ["cough", "fever", "headache", "pain", "weakness", "nausea"];
  for (let symptom of symptoms) {
    if (lowerText.includes(symptom)) {
      return symptom.charAt(0).toUpperCase() + symptom.slice(1);
    }
  }
  
  return "General consultation";
};

const extractSymptoms = (text) => {
  const symptoms = new Set();
  const lowerText = text.toLowerCase();
  
  // Only include symptoms that are actually present (not negated)
  const symptomKeywords = [
    { term: "fever", negative: ["no fever", "without fever"] },
    { term: "cough", negative: ["no cough"] },
    { term: "headache", negative: ["no headache"] },
    { term: "body ache", negative: ["no body ache"] },
    { term: "chest pain", negative: ["no chest pain", "no shortness of breath or chest pain"] },
    { term: "shortness of breath", negative: ["no shortness of breath"] },
    { term: "wheezing", negative: [] },
    { term: "congestion", negative: [] },
    { term: "phlegm", negative: [] },
    { term: "fatigue", negative: [] },
    { term: "tired", negative: ["not tired"] },
    { term: "weakness", negative: ["no weakness"] },
    { term: "nausea", negative: ["no nausea"] }
  ];
  
  symptomKeywords.forEach(({ term, negative }) => {
    // Check if symptom is mentioned
    if (lowerText.includes(term)) {
      // Check if it's negated
      let isNegated = false;
      for (let neg of negative) {
        if (lowerText.includes(neg)) {
          isNegated = true;
          break;
        }
      }
      // Also check for general negation patterns near the symptom
      const symptomIndex = lowerText.indexOf(term);
      const contextBefore = lowerText.substring(Math.max(0, symptomIndex - 30), symptomIndex);
      if (contextBefore.match(/\b(no|not|without|any)\s*$/)) {
        isNegated = true;
      }
      
      if (!isNegated) {
        symptoms.add(term);
      }
    }
  });
  
  // Look for duration
  const durationMatch = text.match(/for (?:about |approximately )?(\d+\s+(?:day|week|month)s?)/i);
  const duration = durationMatch ? ` (duration: ${durationMatch[1]})` : '';
  
  return symptoms.size > 0 
    ? Array.from(symptoms).join(", ") + duration
    : "As described in consultation";
};

const extractDiagnosis = (text) => {
  const lowerText = text.toLowerCase();
  
  // Look for explicit diagnosis statements
  const diagnosisPatterns = [
    /(?:sounds like you have|you have|diagnosed with|diagnosis is)[:\s]+([^.\n]+)/i,
    /(?:it sounds like|appears to be|looks like)[:\s]+([^.\n]+)/i
  ];
  
  for (let pattern of diagnosisPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let diagnosis = match[1].trim();
      // Remove trailing punctuation and clean up
      diagnosis = diagnosis.replace(/[.!?]$/, '').trim();
      // Capitalize properly
      return diagnosis.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    }
  }
  
  // Common diagnoses
  const diagnoses = {
    "acute bronchitis": "Acute Bronchitis",
    "bronchitis": "Bronchitis",
    "viral infection": "Viral Infection",
    "bacterial infection": "Bacterial Infection",
    "migraine": "Migraine",
    "gastritis": "Gastritis",
    "influenza": "Influenza",
    "common cold": "Common Cold",
    "pneumonia": "Pneumonia"
  };
  
  for (let [key, value] of Object.entries(diagnoses)) {
    if (lowerText.includes(key)) {
      return value;
    }
  }
  
  return "Pending further examination";
};

const extractPrescription = (text) => {
  const prescriptions = [];
  
  // Enhanced medication pattern
  const medicationPattern = /([A-Z][a-z]+(?:cillin|mycin|pril|olol|statin|zole|mab)?)[,\s]+(\d+\s*mg)/gi;
  
  let match;
  const foundMeds = new Set();
  
  while ((match = medicationPattern.exec(text)) !== null) {
    const medication = match[1];
    const dosage = match[2];
    
    // Skip if already found
    if (foundMeds.has(medication.toLowerCase())) continue;
    
    // Get context around the medication
    const contextStart = Math.max(0, match.index - 100);
    const contextEnd = Math.min(text.length, match.index + 200);
    const context = text.substring(contextStart, contextEnd);
    
    // Check if this is actually a prescription (not just mentioned as current medication)
    const isPrescription = context.match(/(?:prescribe|prescription|take|you'll take|I will prescribe)/i);
    const isCurrentMed = context.match(/(?:still taking|currently taking|taking the|are you taking)/i);
    
    if (isPrescription && !isCurrentMed) {
      // Look for dosage instructions
      const dosageInstructions = context.match(/(\d+\s+tablets?)[^.]*?(?:first day|day one)/i);
      const frequency = context.match(/(once|twice|three times|one tablet|two tablets)[^.]*?(?:daily|a day|per day)/i);
      const duration = context.match(/for\s+(?:the\s+)?(?:next\s+)?(\d+\s+days?)/i);
      
      let prescription = `${medication} ${dosage}`;
      
      if (dosageInstructions) {
        prescription += ` - ${dosageInstructions[1]} on first day`;
        if (frequency) {
          prescription += `, then ${frequency[1]}`;
        }
      } else if (frequency) {
        prescription += ` - ${frequency[1]}`;
      }
      
      if (duration) {
        prescription += ` for ${duration[1]}`;
      }
      
      prescriptions.push(prescription);
      foundMeds.add(medication.toLowerCase());
    }
  }
  
  return prescriptions.length > 0 
    ? prescriptions.join("; ") 
    : "Medications prescribed during consultation";
};

const extractAdvice = (text) => {
  const advice = new Set();
  const lowerText = text.toLowerCase();
  
  // Look for "recommend" or "advise" statements
  const recommendPattern = /(?:recommend|suggest|advise|want you to)[^.]*?([^.]+)/gi;
  let match;
  
  while ((match = recommendPattern.exec(text)) !== null) {
    const recommendation = match[1].trim();
    if (recommendation.length > 15 && recommendation.length < 150) {
      // Clean up and capitalize
      const cleaned = recommendation
        .replace(/^(that you|you to|you|to)\s+/i, '')
        .trim();
      if (cleaned.length > 10) {
        advice.add(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
      }
    }
  }
  
  // Common medical advice
  const adviceKeywords = {
    "rest": "Get adequate rest",
    "hydrat": "Stay well hydrated",
    "plenty of fluids": "Drink plenty of fluids",
    "cough suppressant": "Use over-the-counter cough suppressant as needed",
    "follow up": "Follow up if symptoms do not improve"
  };
  
  for (let [keyword, recommendation] of Object.entries(adviceKeywords)) {
    if (lowerText.includes(keyword) && !Array.from(advice).some(a => a.toLowerCase().includes(keyword))) {
      advice.add(recommendation);
    }
  }
  
  // Look for urgent care instructions
  if (lowerText.includes("urgent care") || lowerText.includes("emergency")) {
    const urgentMatch = text.match(/(?:if|when)[^.]*?(?:urgent care|emergency|hospital)[^.]*?\./i);
    if (urgentMatch) {
      advice.add(urgentMatch[0].trim());
    }
  }
  
  return advice.size > 0 
    ? Array.from(advice).join(". ") + "."
    : "Follow medical advice and return if symptoms persist or worsen";
};

const handleTranslate = async (targetLang) => {
  if (!transcription || transcription.trim().length === 0) {
    alert("Please record a consultation first");
    return;
  }

  setIsTranslating(true);

  try {
    const result = await translateText(transcription, targetLang);
    
    if (result.success) {
      setTranslatedText(result.translatedText);
      alert(`Translated to ${targetLang.charAt(0).toUpperCase() + targetLang.slice(1)} successfully!`);
    } else {
      throw new Error(result.message || "Translation failed");
    }
  } catch (error) {
    console.error("Translation error:", error);
    alert("Translation failed. Please check your internet connection and try again.");
  } finally {
    setIsTranslating(false);
  }
};

const handleSaveConsultation = async () => {
if (!transcription) {
alert("Please record and transcribe the consultation first");
return;
}

// Check if AI summary is already generated
if (!aiSummary) {
alert("Please generate AI medical analysis first");
return;
}

// Prepare consultation data for API with AI summary
const consultation = {
patient: patientData.name,
age: patientData.age,
gender: patientData.gender,
symptoms: patientData.symptoms,
medicalHistory: patientData.medicalHistory,
transcript: transcription,
language,
date: new Date().toISOString(), // ISO format for better compatibility
time: new Date().toLocaleTimeString(),
diagnosis: aiSummary.diagnosis,
prescription: aiSummary.prescription,
advice: aiSummary.advice
};

try {
// Save to backend API
const result = await saveConsultation(consultation);
console.log("Consultation saved to backend:", result);

if (!result.success) {
  throw new Error(result.message || "Failed to save consultation");
}

// Create notification
try {
  await createNotification(`Consultation saved for ${patientData.name}`);
} catch (notifErr) {
  console.warn("Notification creation failed (non-critical):", notifErr);
}

setConsultationSaved(true);
alert("Consultation saved successfully with AI analysis!");

// Reset form
setTimeout(() => {
setPatientData({
name: "",
age: "",
gender: "",
symptoms: "",
medicalHistory: ""
});
setTranscription("");
setAiSummary(null);
setAiReportText("");
setTranslatedText("");
setConsultationSaved(false);
setCurrentStep(1);
}, 2000);

} catch (error) {
console.error("Error saving consultation:", error);
alert("Failed to save consultation: " + error.message);
}
};

return (

<div className="dashboard-container">

<Sidebar />

<div className="dashboard-main">

<Navbar profilePicture={profilePicture} pageTitle="Record Consultation" />

<div className="dashboard-content">

{consultationSaved && (
<div className="success-box">
Consultation saved successfully! AI summary generated.
</div>
)}

{/* PROGRESS INDICATOR */}
<div className="consultation-progress">
<div className={`progress-step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
<div className="step-number">1</div>
<div className="step-label">Patient Info</div>
</div>
<div className="progress-line"></div>
<div className={`progress-step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
<div className="step-number">2</div>
<div className="step-label">Recording</div>
</div>
<div className="progress-line"></div>
<div className={`progress-step ${currentStep >= 3 ? 'active' : ''}`}>
<div className="step-number">3</div>
<div className="step-label">Review & Save</div>
</div>
</div>

{/* STEP 1: PATIENT INFORMATION */}
{currentStep === 1 && (
<div className="consultation-step">
<div className="step-header">
<h2>Patient Information</h2>
<p>Enter basic patient details to begin consultation</p>
</div>

<div className="consultation-card">
<div className="form-grid">

<div className="form-group">
<label>Patient Name <span className="required">*</span></label>
<input
type="text"
name="name"
placeholder="Enter patient full name"
value={patientData.name}
onChange={handleInputChange}
required
/>
</div>

<div className="form-group">
<label>Age <span className="required">*</span></label>
<input
type="number"
name="age"
placeholder="Age in years"
value={patientData.age}
onChange={handleInputChange}
required
/>
</div>

<div className="form-group">
<label>Gender <span className="required">*</span></label>
<select 
name="gender"
value={patientData.gender}
onChange={handleInputChange}
required
>
<option value="">Select Gender</option>
<option value="Male">Male</option>
<option value="Female">Female</option>
<option value="Other">Other</option>
</select>
</div>

<div className="form-group full-width">
<label>Chief Complaints</label>
<input
type="text"
name="symptoms"
placeholder="e.g., Fever, Cough, Headache"
value={patientData.symptoms}
onChange={handleInputChange}
/>
</div>

<div className="form-group full-width">
<label>Medical History (if any)</label>
<textarea
name="medicalHistory"
placeholder="Previous conditions, allergies, current medications..."
value={patientData.medicalHistory}
onChange={handleInputChange}
rows="3"
/>
</div>

</div>

<div className="step-actions">
<button className="btn-primary" onClick={handleNextStep}>
Next: Start Recording
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<polyline points="9 18 15 12 9 6"></polyline>
</svg>
</button>
</div>

</div>
</div>
)}

{/* STEP 2: RECORDING */}
{currentStep === 2 && (
<div className="consultation-step">
<div className="step-header">
<h2>Record Consultation</h2>
<p>Select language and record the OPD consultation</p>
</div>

{/* LANGUAGE SELECTION */}
<div className="language-selector-compact">
<label>Consultation Language:</label>
<div className="language-tabs">
<button 
className={`language-tab ${language === 'kannada' ? 'active' : ''}`}
onClick={() => setLanguage('kannada')}
>
ಕನ್ನಡ
</button>
<button 
className={`language-tab ${language === 'hindi' ? 'active' : ''}`}
onClick={() => setLanguage('hindi')}
>
हिंदी
</button>
<button 
className={`language-tab ${language === 'english' ? 'active' : ''}`}
onClick={() => setLanguage('english')}
>
English
</button>
</div>
</div>

{/* AUDIO RECORDER */}
<div className="recording-panel">
<AudioRecorder 
isRecording={isRecording}
setIsRecording={setIsRecording}
onTranscriptionUpdate={setTranscription}
language={language}
/>
</div>

<div className="step-actions">
<button className="btn-secondary" onClick={handlePreviousStep}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<polyline points="15 18 9 12 15 6"></polyline>
</svg>
Back
</button>
<button 
className="btn-primary" 
onClick={handleNextStep}
>
Next: Review
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<polyline points="9 18 15 12 9 6"></polyline>
</svg>
</button>
</div>

</div>
)}

{/* STEP 3: REVIEW & SAVE */}
{currentStep === 3 && (
<div className="consultation-step">
<div className="step-header">
<h2>Review & Save</h2>
<p>Review transcription and AI-generated summary</p>
</div>

{/* TRANSCRIPTION EDITOR */}
<TranscriptionEditor 
transcription={transcription}
setTranscription={setTranscription}
language={language}
onGenerateSummary={() => generateAISummary(transcription)}
/>

{/* TRANSLATION SECTION */}
{transcription && (
<div className="translation-panel">
<div className="translation-header">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
</svg>
<h3>Multilingual Translation</h3>
<div className="translation-buttons">
<button 
className="translate-btn translate-btn-english"
onClick={() => handleTranslate('english')}
disabled={isTranslating}
>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<circle cx="12" cy="12" r="10"></circle>
<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
<path d="M2 12h20"></path>
</svg>
{isTranslating ? "..." : "English"}
</button>
<button 
className="translate-btn translate-btn-hindi"
onClick={() => handleTranslate('hindi')}
disabled={isTranslating}
>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<circle cx="12" cy="12" r="10"></circle>
<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
<path d="M2 12h20"></path>
</svg>
{isTranslating ? "..." : "हिंदी"}
</button>
<button 
className="translate-btn translate-btn-kannada"
onClick={() => handleTranslate('kannada')}
disabled={isTranslating}
>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<circle cx="12" cy="12" r="10"></circle>
<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
<path d="M2 12h20"></path>
</svg>
{isTranslating ? "..." : "ಕನ್ನಡ"}
</button>
</div>
</div>

{translatedText && (
<div className="translated-content">
<label>Translated Text:</label>
<div className="translated-text-box">
{translatedText}
</div>
</div>
)}
</div>
)}

{/* AI SUMMARY */}
{aiSummary && (
<div className="ai-summary-panel">
<div className="summary-header">
<div className="summary-header-content">
<div className="summary-icon">
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M9 12l2 2 4-4"></path>
<path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
<path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
<path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"></path>
<path d="M12 21c0-1-1-3-3-3s-3 2-3 3 1 3 3 3 3-2 3-3"></path>
</svg>
</div>
<div className="summary-title">
<h3>AI-Powered Medical Analysis</h3>
<p className="summary-subtitle">Structured clinical documentation generated by AI</p>
</div>
</div>
<div className="summary-badge">
<span className="ai-badge">AI Generated</span>
</div>
</div>

{aiReportText && (
<div className="ai-full-report">
<div className="report-header">
<h4>Comprehensive Medical Report</h4>
<div className="report-meta">
<span className="report-timestamp">Generated: {new Date().toLocaleString()}</span>
<span className="report-model">Model: vLLM AI</span>
</div>
</div>
<div className="report-content">
<pre>{aiReportText}</pre>
</div>
</div>
)}

<div className="summary-grid">
<div className="summary-item">
<label>Chief Complaint:</label>
<div className="summary-content">
<p>{aiSummary.chiefComplaint}</p>
<button className="edit-btn" title="Edit Chief Complaint">✏️</button>
</div>
</div>
<div className="summary-item">
<label>Clinical Symptoms:</label>
<div className="summary-content">
{Array.isArray(aiSummary.symptoms) ? (
<ul className="symptoms-list">
{aiSummary.symptoms.map((symptom, index) => (
<li key={index}>{symptom}</li>
))}
</ul>
) : (
<p>{aiSummary.symptoms}</p>
)}
<button className="edit-btn" title="Edit Symptoms">✏️</button>
</div>
</div>
<div className="summary-item">
<label>Provisional Diagnosis:</label>
<div className="summary-content">
<p>{aiSummary.diagnosis}</p>
<button className="edit-btn" title="Edit Diagnosis">✏️</button>
</div>
</div>
<div className="summary-item">
<label>Prescribed Treatment:</label>
<div className="summary-content">
<p>{aiSummary.prescription}</p>
<button className="edit-btn" title="Edit Prescription">✏️</button>
</div>
</div>
<div className="summary-item full-width">
<label>Medical Recommendations:</label>
<div className="summary-content">
<p>{aiSummary.advice}</p>
<button className="edit-btn" title="Edit Medical Advice">✏️</button>
</div>
</div>
</div>
</div>
)}

{/* AI LOADING STATE */}
{isGeneratingAI && (
<div className="ai-loading-panel">
<div className="loading-header">
<div className="loading-icon">
<div className="ai-spinner"></div>
</div>
<div className="loading-content">
<h3>Generating AI Medical Analysis</h3>
<p className="loading-subtitle">Processing consultation transcript with advanced AI...</p>
</div>
</div>
<div className="loading-steps">
<div className="loading-step active">
<div className="step-dot"></div>
<span>Analyzing transcript</span>
</div>
<div className="loading-step active">
<div className="step-dot"></div>
<span>Extracting medical entities</span>
</div>
<div className="loading-step">
<div className="step-dot"></div>
<span>Generating structured report</span>
</div>
</div>
<div className="loading-progress">
<div className="progress-bar">
<div className="progress-fill"></div>
</div>
<p className="progress-text">This may take 10-30 seconds depending on transcript length</p>
</div>
</div>
)}

<div className="step-actions">
<button className="btn-secondary" onClick={handlePreviousStep}>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<polyline points="15 18 9 12 15 6"></polyline>
</svg>
Back
</button>

{!aiSummary && (
<button 
className="btn-primary ai-generate-btn" 
onClick={() => generateAISummary(transcription)}
disabled={isGeneratingAI || !transcription}
>
{isGeneratingAI ? (
<>
<div className="btn-spinner"></div>
<span>Analyzing with AI...</span>
</>
) : (
<>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M9 12l2 2 4-4"></path>
<path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
<path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
</svg>
<span>Generate AI Medical Analysis</span>
</>
)}
</button>
)}

<button 
className="btn-success" 
onClick={handleSaveConsultation}
disabled={!aiSummary}
>
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
<polyline points="17 21 17 13 7 13 7 21"></polyline>
<polyline points="7 3 7 8 15 8"></polyline>
</svg>
Save Consultation
</button>
</div>

</div>
)}

</div>

</div>

</div>

);

}

export default RecordConsultation;
