
const express = require("express");
const router = express.Router();
const DeviceAssignment = require("../models/DeviceAssignment");
const Device = require("../models/Device");  // Add this import
const { generateID } = require("../utils/idGenerator");

// Assign device to plant
router.post("/assign", async (req, res) => {
  try {
    const { DeviceID, plantID, userID } = req.body;

    // تحقق إذا تم تعيين نفس الجهاز مسبقًا
    const exist = await DeviceAssignment.findOne({ DeviceID });
    if (exist) return res.status(400).json({ message: "Device already assigned" });

    const newAssign = await DeviceAssignment.create({
      AssignmentID: generateID("assign"),
      DeviceID,
      plantID,
      userID,
      status: 'active'
    });

    res.json(newAssign);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all assignments for a user
router.get("/user/:userID", async (req, res) => {
  try {
    const list = await DeviceAssignment.find({ userID: req.params.userID });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ NEW: Get all devices assigned to a specific plant
router.get("/plant/:plantID", async (req, res) => {
  try {
    const { plantID } = req.params;
    
    // Find all assignments for this plant
    const assignments = await DeviceAssignment.find({ plantID });
    
    if (!assignments || assignments.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: "No devices assigned to this plant"
      });
    }
    
    // Extract device IDs from assignments
    const deviceIDs = assignments.map(assignment => assignment.DeviceID);
    
    // Fetch device details
    const devices = await Device.find({ DeviceID: { $in: deviceIDs } });
    
    // Combine assignment info with device data
    const devicesWithAssignmentInfo = devices.map(device => {
      const assignment = assignments.find(a => a.DeviceID === device.DeviceID);
      return {
        ...device.toObject(),
        assignment: {
          assignmentID: assignment?.AssignmentID,
          assignedAt: assignment?.createdAt,
          status: assignment?.status || 'active'
        }
      };
    });
    
    res.json({
      success: true,
      count: devicesWithAssignmentInfo.length,
      data: devicesWithAssignmentInfo
    });
    
  } catch (error) {
    console.error("Error fetching devices for plant:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ NEW: Get all assignments (for admin/management)
router.get("/", async (req, res) => {
  try {
    const assignments = await DeviceAssignment.find();
    res.json({
      success: true,
      count: assignments.length,
      data: assignments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
