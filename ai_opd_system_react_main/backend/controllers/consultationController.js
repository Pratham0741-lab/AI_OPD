let consultations = [];

const saveConsultation = (req, res) => {

const consultation = req.body;

consultation.date = new Date();

consultations.push(consultation);

res.json({
message: "Consultation saved successfully",
data: consultation
});

};

const getConsultations = (req, res) => {

res.json(consultations);

};

module.exports = {
saveConsultation,
getConsultations
};