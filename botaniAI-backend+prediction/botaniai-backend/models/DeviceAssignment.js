const mongoose = require("mongoose");

const DeviceAssignmentSchema = new mongoose.Schema({
  AssignmentID: { type: String, required: true, unique: true },
  DeviceID: { type: String, required: true },  // الربط مع الجهاز
  plantID: { type: String, required: true },   // الربط مع النبتة
  userID: { type: String, required: true },    // صاحب الجهاز أو النبتة
  status: { type: String, default: "active" },
  startDate: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("DeviceAssignment", DeviceAssignmentSchema);
