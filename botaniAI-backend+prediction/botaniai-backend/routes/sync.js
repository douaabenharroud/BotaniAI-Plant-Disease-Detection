//routes/plantRoutes.js
const express = require('express');
const ThingSpeakService = require('../services/thingspeakService');
const SensorReading = require('../models/SensorReading');
const DeviceAssignment = require('../models/DeviceAssignment');
const { protect } = require('../middleware/auth');
const { generateID } = require('../utils/idGenerator');

const router = express.Router();

// ----- This is where your code goes -----
router.post('/:plantId/thingspeak', protect, async (req, res) => {
  try {
    const assignment = await DeviceAssignment.findOne({
      plantID: req.params.plantId,
      userID: req.user.UserID,
      status: 'active'
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found or access denied'
      });
    }

    // Use the channel info from DB
    const { thingSpeakChannelID, thingSpeakWriteAPIKey, SensorID, plantID, userID } = assignment;

    if (!thingSpeakChannelID || !thingSpeakWriteAPIKey) {
      return res.status(400).json({
        success: false,
        message: 'ThingSpeak info not available for this plant'
      });
    }

    // Fetch latest data from ThingSpeak dynamically
    const thingspeakData = await ThingSpeakService.getLatestData(
      thingSpeakChannelID,
      thingSpeakWriteAPIKey
    );

    // Save sensor reading
    const sensorReading = new SensorReading({
      ReadingID: generateID('reading'),
      SensorID,
      DeviceID: assignment.DeviceID,
      plantID,
      userID,
      ...thingspeakData
    });

    await sensorReading.save();

    res.json({
      success: true,
      message: 'Data synced successfully from ThingSpeak',
      data: sensorReading,
      source: thingspeakData.isMock ? 'mock_data' : 'thingspeak'
    });

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing data from ThingSpeak'
    });
  }
});
// ----- End of route -----

module.exports = router;
