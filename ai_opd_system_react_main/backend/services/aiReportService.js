const OpenAI = require("openai");
const axios = require("axios");

// Determine AI provider
const AI_PROVIDER = process.env.AI_PROVIDER || "openai";

let aiClient;
let MODEL;

if (AI_PROVIDER === "sarvam") {
  // Sarvam AI configuration
  MODEL = process.env.SARVAM_MODEL || "sarvam-2b";
  console.log(`✓ AI Service configured with Sarvam AI`);
  console.log(`✓ Model: ${MODEL}`);
  console.log(`✓ Supports: Kannada, Hindi, English, and other Indian languages`);
} else {
  // OpenAI-compatible configuration (vLLM, etc.)
  aiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "EMPTY",
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  });
  MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
  console.log(`✓ AI Service configured with OpenAI-compatible endpoint`);
  console.log(`✓ Using endpoint: ${process.env.OPENAI_BASE_URL || "OpenAI Default"}`);
  console.log(`✓ Model: ${MODEL}`);
}

async function generateMedicalReportSarvam(transcript, patientInfo) {
  const apiKey = process.env.SARVAM_API_KEY;
  
  if (!apiKey || apiKey === "your_sarvam_api_key_here") {
    throw new Error("Sarvam AI API key not configured. Please add SARVAM_API_KEY to .env file");
  }

  const prompt = `You are an expert medical assistant AI. Analyze the following doctor-patient consultation transcript and generate a comprehensive medical report in the same language as the transcript.

Patient Information:
- Name: ${patientInfo.patient || 'N/A'}
- Age: ${patientInfo.age || 'N/A'}
- Gender: ${patientInfo.gender || 'N/A'}

Consultation Transcript:
${transcript}

Please provide a structured medical report with the following sections:

1. CHIEF COMPLAINTS: List the main symptoms reported by the patient
2. CLINICAL FINDINGS: Summarize the doctor's observations and examination findings
3. PROVISIONAL DIAGNOSIS: Provide the most likely diagnosis based on symptoms
4. RECOMMENDED TREATMENT: List prescribed medications with dosage and duration
5. MEDICAL ADVICE: Provide lifestyle recommendations and follow-up instructions

Format the response in a clear, professional medical report style.`;

  try {
    const response = await axios.post(
      'https://api.sarvam.ai/v1/chat/completions',
      {
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "You are a professional medical assistant AI that helps doctors generate accurate medical reports from consultation transcripts. You can understand and respond in multiple Indian languages including Kannada, Hindi, and English."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Sarvam AI Error:", error.response?.data || error.message);
    throw error;
  }
}

async function generateMedicalReportOpenAI(transcript, patientInfo) {
  const prompt = `You are an expert medical assistant AI. Analyze the following doctor-patient consultation transcript and generate a comprehensive medical report.

CRITICAL RULES:
- Use ONLY information explicitly stated in the transcript
- Do NOT invent or assume any physical examination findings
- Do NOT add medical knowledge not mentioned in the consultation
- If physical examination was not performed or mentioned, state "Physical examination not documented"
- If vital signs were not mentioned, state "Vital signs not recorded"

Patient Information:
- Name: ${patientInfo.patient || 'N/A'}
- Age: ${patientInfo.age || 'N/A'}
- Gender: ${patientInfo.gender || 'N/A'}

Consultation Transcript:
${transcript}

Please provide a structured medical report with the following sections:

1. CHIEF COMPLAINTS: List exactly what the patient reported
2. CLINICAL FINDINGS: Include only examination findings explicitly mentioned in transcript
3. PROVISIONAL DIAGNOSIS: Use only the diagnosis stated by the doctor
4. RECOMMENDED TREATMENT: List only medications/treatments prescribed by the doctor
5. MEDICAL ADVICE: Include only advice explicitly given by the doctor

Format the response in a clear, professional medical report style. Do not add any information not present in the transcript.`;

  console.log(`Sending request to ${MODEL}...`);

  const response = await aiClient.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: "You are a professional medical assistant AI that helps doctors generate accurate medical reports from consultation transcripts. Always maintain medical terminology and professional standards."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 1500,
    top_p: 0.95,
    frequency_penalty: 0,
    presence_penalty: 0
  });

  console.log(`✓ Response received from AI`);
  console.log(`Response object:`, JSON.stringify(response, null, 2));
  
  const reportContent = response.choices[0]?.message?.content;
  
  if (!reportContent || reportContent.trim().length === 0 || reportContent === 'null') {
    console.error("AI returned empty or null response");
    console.error("Full response:", JSON.stringify(response));
    throw new Error("AI returned empty response - vLLM might not be configured correctly");
  }
  
  return reportContent;
}

async function generateMedicalReport(transcript, patientInfo) {
  try {
    console.log(`\n=== Generating AI Medical Report ===`);
    console.log(`Provider: ${AI_PROVIDER}`);
    console.log(`Patient: ${patientInfo.patient}`);
    console.log(`Transcript length: ${transcript.length} characters`);
    
    let reportContent;
    
    if (AI_PROVIDER === "sarvam") {
      console.log(`Using Sarvam AI for multilingual support...`);
      reportContent = await generateMedicalReportSarvam(transcript, patientInfo);
    } else {
      console.log(`Using OpenAI-compatible endpoint...`);
      reportContent = await generateMedicalReportOpenAI(transcript, patientInfo);
    }
    
    console.log(`✓ Report generated successfully (${reportContent.length} characters)`);
    
    return reportContent;
  } catch (error) {
    console.error("AI Report Generation Error:", error.message);
    if (error.response) {
      console.error("Response status:", error.response?.status);
      console.error("Response data:", JSON.stringify(error.response?.data));
    }
    throw new Error("Failed to generate AI report: " + error.message);
  }
}

// Clean AI output before sending to frontend
function cleanMedicalData(data) {
  if (data.prescription) {
    // Remove patient confirmations and duplicates
    data.prescription = data.prescription
      .replace(/Okay.*$/i, "")
      .replace(/; Okay.*$/i, "")
      .trim();
  }
  
  if (data.diagnosis && data.diagnosis.toLowerCase().includes("allergy")) {
    data.diagnosis = "Diagnosis unclear from transcript";
  }
  
  if (data.chiefComplaint && data.chiefComplaint.includes("Dr.")) {
    data.chiefComplaint = "Not clearly stated in transcript";
  }
  
  return data;
}

async function extractMedicalEntities(transcript) {
  try {
    if (AI_PROVIDER === "sarvam") {
      // Skip entity extraction for Sarvam AI for now
      return null;
    }
    
    const systemPrompt = `You are a medical documentation assistant.
Extract structured medical information from the consultation transcript.

CRITICAL RULES:
- Use ONLY information explicitly stated by the doctor or patient
- Do NOT invent, assume, or add any physical examination findings
- Do NOT confuse allergies with diagnosis
- Do NOT add medical knowledge not mentioned in the transcript
- If information is not stated, leave field empty or use "Not mentioned"
- Extract symptoms exactly as described by the patient
- Extract diagnosis exactly as stated by the doctor
- Extract prescription exactly as prescribed by the doctor
- Extract medical advice exactly as given by the doctor

Return JSON format only:
{
  "chiefComplaint": "patient's main complaint exactly as stated",
  "symptoms": [
    "symptom 1 exactly as patient described",
    "symptom 2 with patient's own words",
    "symptom 3"
  ],
  "diagnosis": "doctor's exact diagnosis or 'Not provided' if not stated",
  "prescription": "exact medication, dose, frequency, duration as prescribed or 'Not prescribed' if none",
  "medicalAdvice": [
    "exact instruction 1 as doctor stated",
    "exact instruction 2 as doctor stated",
    "exact follow-up instruction as doctor stated"
  ]
}`;

    const response = await aiClient.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript }
      ],
      temperature: 0.2,
      max_tokens: 1000
    });

    const rawContent = response.choices[0].message.content;
    console.log("Raw AI extraction response:", rawContent);
    
    // Try to parse JSON
    let extractedData;
    try {
      // Clean the response in case it has extra text
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : rawContent;
      extractedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw content:", rawContent);
      return null;
    }
    
    // Clean the data
    const cleanedData = cleanMedicalData(extractedData);
    console.log("Cleaned extraction data:", cleanedData);
    
    return cleanedData;
  } catch (error) {
    console.error("Entity Extraction Error:", error);
    return null;
  }
}

module.exports = {
  generateMedicalReport,
  extractMedicalEntities
};
