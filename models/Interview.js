/* =========================================================
   interview.js — Interview Coach modal
   Depends on: app.js (sendMessage from chat.js)
   ========================================================= */

const interviewModal = document.getElementById("interviewModal");

function openInterviewModal() {
  interviewModal.style.display = "flex";
}
function closeInterviewModal() {
  interviewModal.style.display = "none";
}
interviewModal.addEventListener("click", (e) => {
  if (e.target === interviewModal) closeInterviewModal();
});

document.getElementById("startInterviewBtn").addEventListener("click", () => {
  const jobRole = document.getElementById("jobRole").value.trim() || "this role";
  const level = document.getElementById("experienceLevel").value;

  closeInterviewModal();
  sendMessage(
    `Let's do a mock interview. I'm applying for a ${jobRole} position at ${level} experience level. Please act as the interviewer: ask me one interview question at a time, wait for my answer, then give brief constructive feedback before asking the next question. Start now with your first question.`
  );
});