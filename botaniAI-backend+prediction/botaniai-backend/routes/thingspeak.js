// routes/thingspeak.js
const express = require('express');
const ThingSpeakSync = require('../services/thingspeakSync');
const ThingSpeakService = require('../services/thingspeakService');
const router = express.Router();

// Start/stop automatic sync
router.post('/sync/start', (req, res) => {
  try {
    ThingSpeakSync.start();
    res.json({
      success: true,
      message: 'ThingSpeak auto-sync started (30-second intervals)',
      status: ThingSpeakSync.getSyncStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/sync/stop', (req, res) => {
  try {
    ThingSpeakSync.stop();
    res.json({
      success: true,
      message: 'Auto-sync stopped successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Manual sync for a specific channel
router.post('/sync/channel', async (req, res) => {
  try {
    const { channelID, apiKey, deviceID, plantID, userID } = req.body;
    
    if (!channelID || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'channelID and apiKey are required'
      });
    }

    const result = await ThingSpeakSync.manualSync(channelID, apiKey, {
      deviceID,
      plantID,
      userID
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get sync status
router.get('/sync/status', (req, res) => {
  try {
    res.json({
      success: true,
      ...ThingSpeakSync.getSyncStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Force sync all channels now
router.post('/sync/now', async (req, res) => {
  try {
    console.log('🔄 Manual sync requested');
    
    // Run sync in background
    ThingSpeakSync.syncAllChannels()
      .then(() => console.log('✅ Manual sync completed'))
      .catch(err => console.error('❌ Manual sync error:', err));
    
    res.json({
      success: true,
      message: 'Manual sync initiated. Check logs for details.',
      status: ThingSpeakSync.getSyncStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get all ThingSpeak channels from database
router.get('/channels', async (req, res) => {
  try {
    // Get from devices
    const Device = require('../models/Device');
    const Plant = require('../models/Plant');
    
    const deviceChannels = await Device.find({
      thingSpeakChannelID: { $ne: null, $ne: '' },
      thingSpeakWriteAPIKey: { $ne: null, $ne: '' }
    }, 'DeviceID deviceName thingSpeakChannelID thingSpeakWriteAPIKey thingSpeakReadAPIKey userID');
    
    // Get from plants
    const plantChannels = await Plant.find({
      thingSpeakChannelID: { $ne: null, $ne: '' },
      thingSpeakAPIKey: { $ne: null, $ne: '' }
    }, 'PlantID PlantName thingSpeakChannelID thingSpeakAPIKey userID');
    
    res.json({
      success: true,
      data: {
        deviceChannels,
        plantChannels,
        total: deviceChannels.length + plantChannels.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Test ThingSpeak connection
router.post('/test', async (req, res) => {
  try {
    const { channelID, apiKey } = req.body;
    
    if (!channelID || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Please provide channelID and apiKey'
      });
    }
    
    // Clean inputs
    const cleanChannelID = String(channelID).trim();
    const cleanApiKey = String(apiKey).trim();
    
    try {
      // Test connection
      const data = await ThingSpeakService.getLatestData(cleanChannelID, cleanApiKey);
      
      res.json({
        success: true,
        message: 'ThingSpeak connection successful!',
        channelID: cleanChannelID,
        latestData: data,
        testData: {
          temperature: `${data.temperature}°C`,
          humidity: `${data.humidity}%`,
          soilMoisture: `${data.soilMoisture}`,
          lightIntensity: `${data.lightIntensity} lux`,
          timestamp: data.timestamp.toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to connect to ThingSpeak: ${error.message}`,
        channelID: cleanChannelID
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get ThingSpeak channel info
router.get('/channel/:channelID', async (req, res) => {
  try {
    const { channelID } = req.params;
    const { apiKey } = req.query;
    
    if (!channelID || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'channelID and apiKey are required'
      });
    }
    
    const data = await ThingSpeakService.getChannelInfo(channelID, apiKey);
    
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;