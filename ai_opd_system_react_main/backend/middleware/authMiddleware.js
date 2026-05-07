const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "vocabopd_secret_key_2026";

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: "Access token required" 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, doctor) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        message: "Invalid or expired token" 
      });
    }

    req.doctor = doctor;
    next();
  });
}

module.exports = authenticateToken;
