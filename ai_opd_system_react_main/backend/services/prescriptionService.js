const PDFDocument = require("pdfkit");

function generatePrescriptionPDF(consultationData, res) {
  const doc = new PDFDocument({ margin: 50 });
  
  // Pipe PDF to response
  doc.pipe(res);
  
  // Header
  doc.fontSize(24)
     .fillColor('#0066cc')
     .text('MEDICAL PRESCRIPTION', { align: 'center' })
     .moveDown(0.5);
  
  doc.fontSize(10)
     .fillColor('#666666')
     .text('VocabOPD - AI Powered Medical System', { align: 'center' })
     .moveDown(2);
  
  // Horizontal line
  doc.strokeColor('#0066cc')
     .lineWidth(2)
     .moveTo(50, doc.y)
     .lineTo(550, doc.y)
     .stroke()
     .moveDown(1);
  
  // Patient Information Section
  doc.fontSize(14)
     .fillColor('#0066cc')
     .text('PATIENT INFORMATION', { underline: true })
     .moveDown(0.5);
  
  doc.fontSize(11)
     .fillColor('#000000');
  
  const patientInfo = [
    ['Patient Name:', consultationData.patient || 'N/A'],
    ['Age:', consultationData.age ? `${consultationData.age} years` : 'N/A'],
    ['Gender:', consultationData.gender || 'N/A'],
    ['Date:', consultationData.consultation_date ? new Date(consultationData.consultation_date).toLocaleDateString() : new Date().toLocaleDateString()],
    ['Time:', consultationData.consultation_time || new Date().toLocaleTimeString()]
  ];
  
  patientInfo.forEach(([label, value]) => {
    doc.text(label, 50, doc.y, { continued: true, width: 150 })
       .text(value, { width: 350 })
       .moveDown(0.3);
  });
  
  doc.moveDown(1);
  
  // Chief Complaints Section
  if (consultationData.symptoms) {
    doc.fontSize(14)
       .fillColor('#0066cc')
       .text('CHIEF COMPLAINTS', { underline: true })
       .moveDown(0.5);
    
    doc.fontSize(11)
       .fillColor('#000000')
       .text(consultationData.symptoms, { align: 'justify' })
       .moveDown(1);
  }
  
  // Diagnosis Section
  doc.fontSize(14)
     .fillColor('#0066cc')
     .text('DIAGNOSIS', { underline: true })
     .moveDown(0.5);
  
  doc.fontSize(11)
     .fillColor('#000000')
     .text(consultationData.diagnosis || 'Pending clinical evaluation', { align: 'justify' })
     .moveDown(1);
  
  // Prescription Section (Rx Symbol)
  doc.fontSize(16)
     .fillColor('#0066cc')
     .text('℞ PRESCRIPTION', { underline: true })
     .moveDown(0.5);
  
  doc.fontSize(11)
     .fillColor('#000000');
  
  if (consultationData.prescription) {
    const medicines = consultationData.prescription.split('\n');
    medicines.forEach((medicine, index) => {
      if (medicine.trim()) {
        doc.text(`${index + 1}. ${medicine.trim()}`)
           .moveDown(0.3);
      }
    });
  } else {
    doc.text('To be prescribed by doctor');
  }
  
  doc.moveDown(1);
  
  // Medical Advice Section
  doc.fontSize(14)
     .fillColor('#0066cc')
     .text('MEDICAL ADVICE', { underline: true })
     .moveDown(0.5);
  
  doc.fontSize(11)
     .fillColor('#000000')
     .text(consultationData.advice || 'Follow prescribed medication and consult if symptoms persist.', { align: 'justify' })
     .moveDown(2);
  
  // Footer
  doc.fontSize(9)
     .fillColor('#666666')
     .text('_'.repeat(80), { align: 'center' })
     .moveDown(0.5);
  
  doc.text('This is a computer-generated prescription.', { align: 'center' })
     .text('For any queries, please contact the doctor.', { align: 'center' })
     .moveDown(0.5);
  
  doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
  
  // Finalize PDF
  doc.end();
}

module.exports = { generatePrescriptionPDF };
