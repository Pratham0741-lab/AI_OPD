const { translate } = require("@vitalets/google-translate-api");

// Language code mapping
const languageMap = {
  english: "en",
  hindi: "hi",
  kannada: "kn"
};

async function translateText(text, targetLanguage) {
  try {
    const targetCode = languageMap[targetLanguage.toLowerCase()] || targetLanguage;
    
    // Use the translate function from the package
    const result = await translate(text, { to: targetCode });
    
    return {
      success: true,
      originalText: text,
      translatedText: result.text,
      sourceLanguage: result.from?.language?.iso || "unknown",
      targetLanguage: targetCode
    };
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error("Translation failed: " + error.message);
  }
}

async function translateConsultation(consultation, targetLanguage) {
  try {
    const targetCode = languageMap[targetLanguage.toLowerCase()] || targetLanguage;
    const { translate } = require("@vitalets/google-translate-api");
    
    // Translate multiple fields
    const [symptomsResult, transcriptResult] = await Promise.all([
      consultation.symptoms ? translate(consultation.symptoms, { to: targetCode }) : null,
      consultation.transcript ? translate(consultation.transcript, { to: targetCode }) : null
    ]);
    
    return {
      success: true,
      translated: {
        symptoms: symptomsResult ? symptomsResult.text : consultation.symptoms,
        transcript: transcriptResult ? transcriptResult.text : consultation.transcript,
        patient: consultation.patient,
        age: consultation.age,
        gender: consultation.gender,
        language: targetLanguage
      }
    };
  } catch (error) {
    console.error("Consultation translation error:", error);
    throw new Error("Consultation translation failed: " + error.message);
  }
}

async function detectLanguage(text) {
  try {
    const { translate } = require("@vitalets/google-translate-api");
    const result = await translate(text, { to: "en" });
    return {
      success: true,
      detectedLanguage: result.from?.language?.iso || "unknown",
      confidence: result.from?.language?.didYouMean ? 0.5 : 1.0
    };
  } catch (error) {
    console.error("Language detection error:", error);
    throw new Error("Language detection failed: " + error.message);
  }
}

module.exports = {
  translateText,
  translateConsultation,
  detectLanguage
};
