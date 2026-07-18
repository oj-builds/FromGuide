const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: false, // not required for accounts created via Google Sign-In
  },
  googleId: {
    type: String,
    required: false,
  },
  phone: {
    type: String,
    required: false,
  },
  avatar: {
    type: String,
    required: false,
  },
  resetTokenHash: {
    type: String,
    required: false,
  },
  resetTokenExpiry: {
    type: Date,
    required: false,
  },
  preferences: {
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "light",
    },
    accent: {
      type: String,
      enum: ["default", "blue", "green", "red", "orange"],
      default: "default",
    },
    language: {
      type: String,
      enum: ["auto", "english", "pidgin"],
      default: "auto",
    },
  },
  imageGenCount: {
    type: Number,
    default: 0,
  },
  imageGenDate: {
    type: String, // stored as YYYY-MM-DD so we can compare "is this still today"
    default: null,
  },
  xp: {
    type: Number,
    default: 0,
  },
  examsTaken: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
