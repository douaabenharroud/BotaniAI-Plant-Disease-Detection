const express = require('express');
const Device = require('../models/Device');
const DeviceAssignment = require('../models/DeviceAssignment');
const Action = require('../models/Action');
const { protect } = require('../middleware/auth');
const { generateID } = require('../utils/idGenerator');
const ThingSpeakService = require('../services/thingspeakService');
const SensorData = require('../models/SensorReading');

const router = express.Router();

// Get all devices for current user
router.get('/', protect, async (req, res) => {
  try {
    const assignments = await DeviceAssignment.find({ 
      userID: req.user.UserID,
      status: 'active'
    });

    const deviceIDs = assignments.map(assignment => assignment.DeviceID);
    const devices = await Device.find({ DeviceID: { $in: deviceIDs } });

    res.json({
      success: true,
      count: devices.length,
      data: devices
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching devices'
    });
  }
});

// Get devices by plant ID
router.get('/plant/:plantID', protect, async (req, res) => {
  try {
    // Find assignments for this plant and user
    const assignments = await DeviceAssignment.find({
      plantID: req.params.plantID,
      userID: req.user.UserID
    });

    if (!assignments || assignments.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: "No devices found for this plant"
      });
    }

    const deviceIDs = assignments.map(assignment => assignment.DeviceID);
    const devices = await Device.find({ DeviceID: { $in: deviceIDs } });

    // Filter to show only sensors
    const sensors = devices.filter(device => 
      (device.deviceType?.toLowerCase() || '') === 'sensor'
    );

    res.json({
      success: true,
      count: sensors.length,
      data: sensors
    });
  } catch (error) {
    console.error('Get devices by plant error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching plant devices'
    });
  }
});

// Get single device with details
router.get('/:id', protect, async (req, res) => {
  try {
    const assignment = await DeviceAssignment.findOne({
      DeviceID: req.params.id,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const device = await Device.findOne({ DeviceID: req.params.id });
    
    // Get recent sensor data
    const recentSensorData = await SensorData.find({
      DeviceID: req.params.id
    })
    .sort({ timestamp: -1 })
    .limit(10);
    
    const assignments = await DeviceAssignment.find({ DeviceID: req.params.id });
    const recentActions = await Action.getActionsByDevice(req.params.id);

    res.json({
      success: true,
      data: {
        device,
        assignments,
        recentSensorData,
        recentActions: recentActions.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching device details'
    });
  }
});

// Register new device (with all fields including ThingSpeak)
router.post('/', protect, async (req, res) => {
  try {
    console.log('📥 Received device creation request:', req.body);
    
    const {
      deviceName,
      deviceType = 'sensor',
      SensorID = '',
      userID,
      Status = 'active',
      firmwareVersion = '1.0.0',
      capabilities = ['temperature', 'humidity', 'soil_moisture', 'light'],
      thingSpeakChannelID = null,
      thingSpeakWriteAPIKey = null,
      thingSpeakReadAPIKey = null,
      location = ''
    } = req.body;

    // Generate DeviceID if not provided
    const DeviceID = req.body.DeviceID || generateID('device');

    console.log('🛠 Creating device with data:', {
      DeviceID,
      deviceName,
      deviceType,
      SensorID,
      userID: userID || req.user?.UserID,
      Status,
      firmwareVersion,
      capabilities,
      thingSpeakChannelID: thingSpeakChannelID ? '***' + String(thingSpeakChannelID).slice(-4) : null,
      thingSpeakWriteAPIKey: thingSpeakWriteAPIKey ? '***' + String(thingSpeakWriteAPIKey).slice(-4) : null,
      thingSpeakReadAPIKey: thingSpeakReadAPIKey ? '***' + String(thingSpeakReadAPIKey).slice(-4) : null,
      location
    });

    const device = await Device.create({
      DeviceID,
      deviceName: deviceName || 'My Device',
      deviceType,
      SensorID,
      userID: userID || req.user?.UserID,
      Status,
      firmwareVersion,
      capabilities,
      thingSpeakChannelID,
      thingSpeakWriteAPIKey,
      thingSpeakReadAPIKey,
      location,
      lastSyncTime: new Date(),
      lastData: null
    });

    console.log('✅ Device created successfully:', {
      _id: device._id,
      DeviceID: device.DeviceID,
      deviceName: device.deviceName,
      thingSpeakChannelID: device.thingSpeakChannelID ? '***' + String(device.thingSpeakChannelID).slice(-4) : null,
      thingSpeakConfigured: !!(device.thingSpeakChannelID && device.thingSpeakWriteAPIKey)
    });

    res.status(201).json({
      success: true,
      data: device,
      message: 'Device created successfully'
    });
  } catch (error) {
    console.error('❌ Create device error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Device ID already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating device: ' + error.message
    });
  }
});

// Update device
router.put('/:id', protect, async (req, res) => {
  try {
    const assignment = await DeviceAssignment.findOne({
      DeviceID: req.params.id,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const device = await Device.findOneAndUpdate(
      { DeviceID: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );

    await Action.logAction(
      req.user.UserID,
      req.params.id,
      'system',
      `Device updated: ${JSON.stringify(req.body)}`
    );

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating device'
    });
  }
});

// Update device with ThingSpeak config
router.put('/:id/thingspeak', protect, async (req, res) => {
  try {
    const assignment = await DeviceAssignment.findOne({
      DeviceID: req.params.id,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const { thingSpeakChannelID, thingSpeakWriteAPIKey, thingSpeakReadAPIKey } = req.body;
    
    const device = await Device.findOneAndUpdate(
      { DeviceID: req.params.id },
      {
        thingSpeakChannelID,
        thingSpeakWriteAPIKey,
        thingSpeakReadAPIKey,
        lastSyncTime: new Date()
      },
      { new: true }
    );

    await Action.logAction(
      req.user.UserID,
      req.params.id,
      'system',
      `ThingSpeak configuration updated for device ${device.deviceName}`
    );

    res.json({
      success: true,
      data: device,
      message: 'ThingSpeak configuration updated successfully'
    });
  } catch (error) {
    console.error('Update ThingSpeak config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating ThingSpeak configuration'
    });
  }
});

// Test ThingSpeak connection
router.post('/:id/test-thingspeak', protect, async (req, res) => {
  try {
    const assignment = await DeviceAssignment.findOne({
      DeviceID: req.params.id,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const device = await Device.findOne({ DeviceID: req.params.id });
    
    if (!device.thingSpeakChannelID || !device.thingSpeakWriteAPIKey) {
      return res.status(400).json({
        success: false,
        message: 'ThingSpeak configuration not set for this device'
      });
    }

    // Clean and validate inputs
    const channelID = String(device.thingSpeakChannelID).trim();
    const apiKey = String(device.thingSpeakWriteAPIKey).trim();
    
    if (!channelID || !apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ThingSpeak configuration'
      });
    }

    // Test ThingSpeak connection by sending test data
    try {
      const result = await ThingSpeakService.sendDataToThingSpeak(
        channelID,
        apiKey,
        {
          temperature: 25.0,
          humidity: 60.0,
          soilMoisture: 45.0,
          lightIntensity: 800.0
        }
      );
      
      await Action.logAction(
        req.user.UserID,
        req.params.id,
        'system',
        `ThingSpeak connection tested successfully. Entry ID: ${result.entryId}`
      );
      
      res.json({
        success: true,
        message: 'ThingSpeak connection successful',
        data: result
      });
      
    } catch (thingspeakError) {
      console.error('ThingSpeak test error:', thingspeakError);
      
      // Check Action model enum
      try {
        await Action.logAction(
          req.user.UserID,
          req.params.id,
          'system_error',
          `ThingSpeak connection failed: ${thingspeakError.message}`
        );
      } catch (actionError) {
        console.error('Failed to log action:', actionError.message);
        // Use alternative if 'system_error' not in enum
        await Action.logAction(
          req.user.UserID,
          req.params.id,
          'monitoring',
          `ThingSpeak connection failed: ${thingspeakError.message}`
        );
      }
      
      res.status(400).json({
        success: false,
        message: 'ThingSpeak connection failed',
        error: thingspeakError.message
      });
    }
    
  } catch (error) {
    console.error('Test ThingSpeak error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing ThingSpeak connection'
    });
  }
});

// Fetch data from ThingSpeak for a device
router.get('/:id/thingspeak-data', protect, async (req, res) => {
  try {
    const assignment = await DeviceAssignment.findOne({
      DeviceID: req.params.id,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const device = await Device.findOne({ DeviceID: req.params.id });
    
    if (!device.thingSpeakChannelID || !device.thingSpeakWriteAPIKey) {
      return res.status(400).json({
        success: false,
        message: 'ThingSpeak configuration not set for this device'
      });
    }

    // Add this DELETE endpoint to devices.js (backend)
router.delete('/:id', protect, async (req, res) => {
  try {
    const assignment = await DeviceAssignment.findOne({
      DeviceID: req.params.id,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    // Delete device assignments first
    await DeviceAssignment.deleteMany({ DeviceID: req.params.id });
    
    // Delete sensor data
    await SensorData.deleteMany({ DeviceID: req.params.id });
    
    // Delete the device
    const device = await Device.findOneAndDelete({ DeviceID: req.params.id });

    await Action.logAction(
      req.user.UserID,
      req.params.id,
      'system',
      `Device deleted: ${device?.deviceName || req.params.id}`
    );

    res.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting device'
    });
  }
});
    // Clean inputs
    const channelID = String(device.thingSpeakChannelID).trim();
    const apiKey = String(device.thingSpeakReadAPIKey || device.thingSpeakWriteAPIKey).trim();
    
    // Fetch latest data from ThingSpeak
    const data = await ThingSpeakService.getLatestData(channelID, apiKey);
    
    // Save to database if we got real data
    if (data && data.temperature !== undefined && !data.isMock) {
      const sensorReading = new SensorData({
        SensorID: device.SensorID || device.DeviceID,
        DeviceID: device.DeviceID,
        AssignmentID: assignment.AssignmentID,
        plantID: assignment.plantID,
        userID: assignment.userID,
        temperature: data.temperature,
        humidity: data.humidity,
        soilMoisture: data.soilMoisture,
        lightIntensity: data.lightIntensity,
        timestamp: data.timestamp || new Date(),
        metadata: {
          source: 'thingspeak',
          channelId: channelID,
          entryId: data.entryId,
          syncedAt: new Date(),
          isMock: data.isMock || false
        }
      });
      
      await sensorReading.save();
      
      // Update device last data
      await Device.findOneAndUpdate(
        { DeviceID: req.params.id },
        {
          lastData: {
            temperature: data.temperature,
            humidity: data.humidity,
            soilMoisture: data.soilMoisture,
            lightIntensity: data.lightIntensity,
            timestamp: data.timestamp || new Date()
          },
          lastSyncTime: new Date()
        }
      );
      
      await Action.logAction(
        req.user.UserID,
        req.params.id,
        'monitoring',
        `ThingSpeak data fetched and saved: Temp=${data.temperature}°C, Hum=${data.humidity}%`
      );
    }
    
    res.json({
      success: true,
      data: data,
      isMock: data?.isMock || false,
      message: data ? 
        (data.isMock ? 'Using mock data (ThingSpeak not accessible)' : 'ThingSpeak data fetched successfully') 
        : 'No data available from ThingSpeak'
    });
    
  } catch (error) {
    console.error('Fetch ThingSpeak data error:', error);
    await Action.logAction(
      req.user.UserID,
      req.params.id,
      'monitoring',
      `Failed to fetch ThingSpeak data: ${error.message}`
    );
    
    res.status(500).json({
      success: false,
      message: 'Error fetching ThingSpeak data',
      error: error.message
    });
  }
});

// Get device status
router.get('/:id/status', protect, async (req, res) => {
  try {
    const assignment = await DeviceAssignment.findOne({
      DeviceID: req.params.id,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const device = await Device.findOne({ DeviceID: req.params.id });
    
    // Get device status
    const status = device.Status || 'unknown';
    
    // Check if device is online (based on last sync time)
    const isOnline = device.lastSyncTime && 
      (new Date() - device.lastSyncTime) < (15 * 60 * 1000); // 15 minutes
    
    // Get latest sensor data
    const latestData = await SensorData.findOne({
      DeviceID: req.params.id
    })
    .sort({ timestamp: -1 })
    .limit(1);

    res.json({
      success: true,
      data: {
        DeviceID: device.DeviceID,
        deviceName: device.deviceName,
        status,
        isOnline,
        lastSyncTime: device.lastSyncTime,
        firmwareVersion: device.firmwareVersion,
        location: device.location,
        thingSpeakConfigured: !!(device.thingSpeakChannelID && device.thingSpeakWriteAPIKey),
        latestData: latestData || device.lastData,
        capabilities: device.capabilities
      }
    });
  } catch (error) {
    console.error('Get device status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching device status'
    });
  }
});

// Get device sensor data history
router.get('/:id/sensor-data', protect, async (req, res) => {
  try {
    const assignment = await DeviceAssignment.findOne({
      DeviceID: req.params.id,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const { 
      limit = 100, 
      hours = 24,
      startDate,
      endDate 
    } = req.query;
    
    let query = { DeviceID: req.params.id };
    
    // Add time filter
    if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (hours && hours !== 'all') {
      const cutoffTime = new Date(Date.now() - (parseInt(hours) * 60 * 60 * 1000));
      query.timestamp = { $gte: cutoffTime };
    }
    
    const sensorData = await SensorData.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    // Get statistics
    const stats = {
      total: await SensorData.countDocuments({ DeviceID: req.params.id }),
      periodTotal: sensorData.length,
      bySource: {
        direct: await SensorData.countDocuments({ ...query, 'metadata.source': 'direct' }),
        thingspeak: await SensorData.countDocuments({ ...query, 'metadata.source': 'thingspeak' }),
        manual: await SensorData.countDocuments({ ...query, 'metadata.source': 'manual' })
      }
    };
    
    res.json({
      success: true,
      count: sensorData.length,
      stats: stats,
      data: sensorData
    });
  } catch (error) {
    console.error('Get device sensor data error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching device sensor data'
    });
  }
});

// Get all devices with ThingSpeak config (admin)
router.get('/admin/thingspeak-devices', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }
    
    const devices = await Device.find({
      thingSpeakChannelID: { $ne: null, $ne: '' },
      thingSpeakWriteAPIKey: { $ne: null, $ne: '' }
    });
    
    // Get sync status for each device
    const devicesWithStatus = await Promise.all(
      devices.map(async (device) => {
        const latestData = await SensorData.findOne({
          DeviceID: device.DeviceID,
          'metadata.source': 'thingspeak'
        })
        .sort({ timestamp: -1 })
        .limit(1);
        
        const maskedWriteKey = device.thingSpeakWriteAPIKey ? 
          '***' + String(device.thingSpeakWriteAPIKey).slice(-4) : 'none';
        const maskedReadKey = device.thingSpeakReadAPIKey ? 
          '***' + String(device.thingSpeakReadAPIKey).slice(-4) : 'none';
        
        return {
          DeviceID: device.DeviceID,
          deviceName: device.deviceName,
          userID: device.userID,
          channelID: device.thingSpeakChannelID,
          writeAPIKey: maskedWriteKey,
          readAPIKey: maskedReadKey,
          latestSync: latestData?.timestamp,
          syncStatus: latestData ? 'synced' : 'never',
          dataCount: await SensorData.countDocuments({
            DeviceID: device.DeviceID,
            'metadata.source': 'thingspeak'
          })
        };
      })
    );
    
    res.json({
      success: true,
      count: devicesWithStatus.length,
      data: devicesWithStatus
    });
  } catch (error) {
    console.error('Get ThingSpeak devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ThingSpeak devices'
    });
  }
});

// Send data to ThingSpeak manually
router.post('/:id/send-to-thingspeak', protect, async (req, res) => {
  try {
    const assignment = await DeviceAssignment.findOne({
      DeviceID: req.params.id,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const device = await Device.findOne({ DeviceID: req.params.id });
    
    if (!device.thingSpeakChannelID || !device.thingSpeakWriteAPIKey) {
      return res.status(400).json({
        success: false,
        message: 'ThingSpeak configuration not set for this device'
      });
    }
    
    const { temperature, humidity, soilMoisture, lightIntensity } = req.body;
    
    // Clean inputs
    const channelID = String(device.thingSpeakChannelID).trim();
    const apiKey = String(device.thingSpeakWriteAPIKey).trim();
    
    const result = await ThingSpeakService.sendDataToThingSpeak(
      channelID,
      apiKey,
      {
        temperature: temperature || 0,
        humidity: humidity || 0,
        soilMoisture: soilMoisture || 0,
        lightIntensity: lightIntensity || 0
      }
    );
    
    await Action.logAction(
      req.user.UserID,
      req.params.id,
      'monitoring',
      `Data sent to ThingSpeak manually. Entry ID: ${result.entryId}`
    );
    
    res.json({
      success: true,
      message: 'Data sent to ThingSpeak successfully',
      data: result
    });
    
  } catch (error) {
    console.error('Send to ThingSpeak error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending data to ThingSpeak'
    });
  }
});

// Debug endpoint to check device ThingSpeak credentials
router.get('/:id/debug/thingspeak', protect, async (req, res) => {
  try {
    const assignment = await DeviceAssignment.findOne({
      DeviceID: req.params.id,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const device = await Device.findOne({ DeviceID: req.params.id });
    
    res.json({
      success: true,
      data: {
        DeviceID: device.DeviceID,
        deviceName: device.deviceName,
        thingSpeakChannelID: device.thingSpeakChannelID,
        thingSpeakWriteAPIKey: device.thingSpeakWriteAPIKey ? 
          '***' + String(device.thingSpeakWriteAPIKey).slice(-4) : null,
        thingSpeakReadAPIKey: device.thingSpeakReadAPIKey ? 
          '***' + String(device.thingSpeakReadAPIKey).slice(-4) : null,
        isConfigured: !!(device.thingSpeakChannelID && device.thingSpeakWriteAPIKey),
        lastSyncTime: device.lastSyncTime,
        lastData: device.lastData
      }
    });
  } catch (error) {
    console.error('Debug ThingSpeak error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;