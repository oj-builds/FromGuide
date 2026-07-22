const mongoose = require("mongoose");

// One document per (user, subject) pair. Cumulative counters rather than a
// per-quiz log, since all the Progress page needs is a running percentage —
// keep this model here rather than bolting it onto User.js so it doesn't
// touch a schema I haven't seen.
const subjectProgressSchema = new mongoose.Schema(
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
    questionsAnswered: {
      type: Number,
      default: 0,
    },
    questionsCorrect: {
      type: Number,
      default: 0,
    },
    lastPracticed: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// A user has exactly one running-total document per subject
subjectProgressSchema.index({ user: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model("SubjectProgress", subjectProgressSchema);