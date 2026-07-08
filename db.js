const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    console.error("⚠️ The app will keep running, but login/signup won't work until this is fixed.");
    // Not calling process.exit() here on purpose — a database hiccup
    // shouldn't take down features that don't need the database.
  }
};

module.exports = connectDB;