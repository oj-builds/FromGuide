/* =========================================================
   cv.js — CV Builder modal
   Depends on: app.js (sendMessage from chat.js used on polish)
   ========================================================= */

const cvModal = document.getElementById("cvModal");
const cvPreviewEl = document.getElementById("cvPreview");
const polishCvBtn = document.getElementById("polishCvBtn");
const downloadCvBtn = document.getElementById("downloadCvBtn");
let lastCvText = "";

function openCvModal() {
  cvModal.style.display = "flex";
}
function closeCvModal() {
  cvModal.style.display = "none";
}
cvModal.addEventListener("click", (e) => {
  if (e.target === cvModal) closeCvModal();
});

document.getElementById("generateCV").addEventListener("click", () => {
  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const education = document.getElementById("education").value.trim();
  const experience = document.getElementById("experience").value.trim();
  const skills = document.getElementById("skills").value.trim();

  if (!fullName) {
    alert("Please enter at least your full name.");
    return;
  }

  const cv = `${fullName}
${email ? "Email: " + email : ""}${phone ? "  |  Phone: " + phone : ""}

EDUCATION
${education || "Not provided"}

WORK EXPERIENCE
${experience || "Not provided"}

SKILLS
${skills || "Not provided"}`;

  lastCvText = cv;
  cvPreviewEl.innerText = cv;
  cvPreviewEl.style.display = "block";
  downloadCvBtn.style.display = "block";
  polishCvBtn.style.display = "block";
});

downloadCvBtn.addEventListener("click", () => {
  if (!lastCvText) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const marginLeft = 50;
  const marginTop = 60;
  const maxWidth = 495;
  const lineHeight = 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const lines = doc.splitTextToSize(lastCvText, maxWidth);

  let y = marginTop;
  const pageHeight = doc.internal.pageSize.getHeight();

  lines.forEach((line) => {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = marginTop;
    }
    doc.text(line, marginLeft, y);
    y += lineHeight;
  });

  const fileName = document.getElementById("fullName").value.trim() || "CV";
  doc.save(`${fileName.replace(/\s+/g, "_")}_CV.pdf`);
});

polishCvBtn.addEventListener("click", () => {
  if (!lastCvText) return;
  closeCvModal();
  sendMessage(
    `Please improve and professionally format this CV, keeping all the real information the same:\n\n${lastCvText}`
  );
});