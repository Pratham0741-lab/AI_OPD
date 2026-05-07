const express = require("express");

const router = express.Router();

const {
saveConsultation,
getConsultations
} = require("../controllers/consultationController");

router.post("/consultation", saveConsultation);

router.get("/consultations", getConsultations);

module.exports = router;