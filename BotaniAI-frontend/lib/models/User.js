const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  UserID: { type: String, required: true },
  Email: { type: String, required: true, unique: true },
  Name: { type: String, required: true },
  Username: { type: String, required: true, unique: true },
  HashedPassword: { type: String, required: true },
  CreatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
