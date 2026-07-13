const mongoose = require("mongoose");

const memorySchema = new mongoose.Schema(
{
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },

    memories: [
        {
            key: String,
            value: String
        }
    ]
},
{
    timestamps: true
}
);

module.exports = mongoose.model("Memory", memorySchema);