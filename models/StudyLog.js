const mongoose = require("mongoose");

// One document per real practice-quiz attempt. SubjectProgress (separate
// model) keeps the running cumulative totals; this model keeps the actual
// history so the Study Calendar can show which real days had activity,
// instead of a single "lastPracticed" timestamp.
const studyLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
    },
    correct: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true } // createdAt is the real date/time of that practice session
);

studyLogSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("StudyLog", studyLogSchema);