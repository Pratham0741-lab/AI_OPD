// Minimal test server with just transcribe endpoint
const express = require('express');
const multer = require('multer');

const app = express();
const PORT = 5001; // Different port to avoid conflict

// Configure multer
const audioStorage = multer.memoryStorage();
const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Test endpoint without auth
app.post("/api/transcribe", audioUpload.single('audio'), async (req, res) => {
  console.log('✓ Transcribe endpoint called!');
  console.log('File:', req.file ? 'Present' : 'Missing');
  console.log('Body:', req.body);
  
  res.json({
    success: true,
    message: "Test endpoint working!",
    file: req.file ? {
      size: req.file.size,
      mimetype: req.file.mimetype
    } : null
  });
});

app.listen(PORT, () => {
  console.log(`✓ Test server running on port ${PORT}`);
  console.log(`✓ Endpoint: POST http://localhost:${PORT}/api/transcribe`);
});
