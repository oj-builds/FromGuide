const mongoose = require("mongoose");

const memoryEntrySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const memorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    memories: [memoryEntrySchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Memory", memorySchema);
