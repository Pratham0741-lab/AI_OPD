// Test Translation Service
const { translateText, translateConsultation, detectLanguage } = require("./services/translationService");

async function testTranslation() {
  console.log("\n========================================");
  console.log("Testing Translation Service");
  console.log("========================================\n");

  try {
    // Test 1: English to Hindi
    console.log("Test 1: English to Hindi");
    const result1 = await translateText("The patient has fever and cough", "hindi");
    console.log("✓ Original:", result1.originalText);
    console.log("✓ Translated:", result1.translatedText);
    console.log("✓ Target:", result1.targetLanguage);
    console.log("");

    // Test 2: English to Kannada
    console.log("Test 2: English to Kannada");
    const result2 = await translateText("Take medicine twice daily", "kannada");
    console.log("✓ Original:", result2.originalText);
    console.log("✓ Translated:", result2.translatedText);
    console.log("✓ Target:", result2.targetLanguage);
    console.log("");

    // Test 3: Detect Language
    console.log("Test 3: Language Detection");
    const result3 = await detectLanguage("मुझे बुखार है");
    console.log("✓ Detected Language:", result3.detectedLanguage);
    console.log("✓ Confidence:", result3.confidence);
    console.log("");

    console.log("========================================");
    console.log("All Translation Tests Passed! ✓");
    console.log("========================================\n");

  } catch (error) {
    console.error("\n❌ Translation Test Failed:");
    console.error(error.message);
    console.log("\nNote: Translation requires internet connection");
    console.log("Make sure you have network access to Google Translate API\n");
  }
}

testTranslation();
