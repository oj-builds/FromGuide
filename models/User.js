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
    default: null,
  },
  googleId: {
    type: String,
    default: null,
  },
  phone: {
    type: String,
    default: null,
  },
  avatar: {
    type: String,
    default: null,
  },
  resetTokenHash: {
    type: String,
    default: null,
  },
  resetTokenExpiry: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
