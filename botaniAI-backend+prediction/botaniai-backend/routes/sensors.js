// sensors.js - COMPLETE UPDATED VERSION
const express = require('express');
const SensorData = require('../models/SensorReading');
const DeviceAssignment = require('../models/DeviceAssignment');
const Device = require('../models/Device');
const ThingSpeakService = require('../services/thingspeakService');
const router = express.Router();

// Helper function to convert raw soil moisture to percentage
function convertSoilMoistureToPercent(rawValue) {
  // Convert raw analog value (1017) to percentage
  // Assuming:
  // - Dry: 4095 (no water)
  // - Wet: 1000 (fully in water)
  const maxRaw = 4095;  // Dry
  const minRaw = 1000;  // Wet
  
  // Clamp value
  const clamped = Math.max(minRaw, Math.min(maxRaw, rawValue));
  
  // Convert to percentage (0% = wet, 100% = dry)
  const percent = ((maxRaw - clamped) / (maxRaw - minRaw)) * 100;
  
  return Math.round(percent * 10) / 10; // Round to 1 decimal
}

// Save new sensor reading manually
router.post('/add', async (req, res) => {
  try {
    const { assignmentID, temperature, humidity, soilMoisture, lightIntensity } = req.body;

    const assignment = await DeviceAssignment.findOne({ AssignmentID: assignmentID });
    if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });

    const data = new SensorData({
      assignmentID,
      DeviceID: assignment.DeviceID,
      plantID: assignment.plantID,
      userID: assignment.userID,
      temperature,
      humidity,
      soilMoisture,
      lightIntensity,
      metadata: {
        source: 'manual'
      }
    });

    await data.save();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Direct sensor data submission from devices
router.post('/submit', async (req, res) => {
  try {
    const { 
      deviceID, 
      temperature, 
      humidity, 
      soilMoisture, 
      lightIntensity,
      apiKey // Optional API key for security
    } = req.body;

    // Verify device exists
    const device = await Device.findOne({ DeviceID: deviceID });
    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found" });
    }

    // Optional: Verify API key if provided
    if (apiKey && apiKey !== process.env.ESP32_API_KEY) {
      return res.status(401).json({ success: false, message: "Invalid API key" });
    }

    // Find active assignment for this device
    const assignment = await DeviceAssignment.findOne({ 
      DeviceID: deviceID, 
      status: 'active' 
    });

    if (!assignment) {
      return res.status(404).json({ 
        success: false, 
        message: "No active assignment found for this device" 
      });
    }

    // Save to database
    const sensorReading = new SensorData({
      SensorID: device.SensorID || deviceID,
      DeviceID: deviceID,
      AssignmentID: assignment.AssignmentID,
      plantID: assignment.plantID,
      userID: assignment.userID,
      temperature,
      humidity,
      soilMoisture,
      lightIntensity,
      metadata: {
        source: 'direct'
      }
    });

    await sensorReading.save();

    // Send to ThingSpeak if configured
    if (device.thingSpeakChannelID && device.thingSpeakWriteAPIKey) {
      try {
        await ThingSpeakService.sendDataToThingSpeak(
          device.thingSpeakChannelID,
          device.thingSpeakWriteAPIKey,
          { temperature, humidity, soilMoisture, lightIntensity }
        );
        console.log(`✅ Data sent to ThingSpeak channel ${device.thingSpeakChannelID}`);
        
        // Update metadata
        sensorReading.metadata.source = 'thingspeak';
        await sensorReading.save();
      } catch (thingspeakError) {
        console.error('❌ ThingSpeak send error:', thingspeakError.message);
      }
    }

    res.json({ 
      success: true, 
      message: 'Sensor data saved successfully',
      data: sensorReading
    });

  } catch (error) {
    console.error('❌ Sensor submit error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Fetch data from ThingSpeak and save to database
router.post('/fetch-thingspeak', async (req, res) => {
  try {
    const { deviceID, assignmentID } = req.body;
    
    // Find device to get ThingSpeak credentials
    const device = await Device.findOne({ DeviceID: deviceID });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found"
      });
    }

    if (!device.thingSpeakChannelID || !device.thingSpeakWriteAPIKey) {
      return res.status(400).json({
        success: false,
        message: "ThingSpeak credentials not configured for this device"
      });
    }

    // Fetch latest data from ThingSpeak
    const data = await ThingSpeakService.getLatestData(
      device.thingSpeakChannelID, 
      device.thingSpeakWriteAPIKey
    );
    
    // Get assignment info
    const assignment = await DeviceAssignment.findOne({ 
      AssignmentID: assignmentID || device.DeviceID 
    });
    
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found"
      });
    }
    
    // Save to database
    const sensorReading = new SensorData({
      SensorID: device.SensorID || deviceID,
      DeviceID: deviceID,
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
        channelId: device.thingSpeakChannelID,
        entryId: data.entry_id,
        syncedAt: new Date()
      }
    });
    
    await sensorReading.save();
    
    res.json({
      success: true,
      message: 'ThingSpeak data fetched and saved successfully',
      data: sensorReading
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Route to prepare ThingSpeak data for prediction
router.post('/prepare-for-prediction', async (req, res) => {
  try {
    const { deviceID, plantID } = req.body;
    
    console.log(`📡 Preparing ThingSpeak data for prediction - Device: ${deviceID}, Plant: ${plantID}`);

    // Find device
    const device = await Device.findOne({ DeviceID: deviceID });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found"
      });
    }

    // Get the latest sensor reading from database
    const latestReading = await SensorData.findOne({
      DeviceID: deviceID,
      plantID: plantID
    })
    .sort({ createdAt: -1 })
    .limit(1);

    if (!latestReading) {
      return res.status(404).json({
        success: false,
        message: "No sensor data found for this device and plant"
      });
    }

    console.log('📊 Latest sensor reading:', latestReading);

    // Find assignment
    const assignment = await DeviceAssignment.findOne({
      DeviceID: deviceID,
      plantID: plantID,
      status: 'active'
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Active assignment not found"
      });
    }

    // Get plant data
    const Plant = require('../models/Plant');
    const plant = await Plant.findOne({ _id: plantID });
    
    if (!plant) {
      return res.status(404).json({
        success: false,
        message: "Plant not found"
      });
    }

    // Convert raw soil moisture to percentage
    const rawSoilMoisture = latestReading.soilMoisture || 1017;
    const soilMoisturePercent = convertSoilMoistureToPercent(rawSoilMoisture);

    // Prepare prediction data
    const predictionData = {
      Height_cm: plant.height || plant.PlantHeight || 30,
      Leaf_Count: plant.leafCount || plant.LeafCount || 12,
      New_Growth_Count: plant.newGrowthCount || plant.NewGrowthCount || 2,
      Watering_Amount_ml: plant.wateringAmount || plant.WateringAmount || 250,
      Watering_Frequency_days: plant.wateringFrequency || plant.WateringFrequency || 3,
      Room_Temperature_C: latestReading.temperature || 25,
      Humidity_percent: latestReading.humidity || 50,
      Soil_Moisture_percent: soilMoisturePercent,
      deviceAssignmentID: assignment._id || assignment.AssignmentID,
      sensorReadingID: latestReading._id,
      userID: assignment.userID,
      plantID: plantID,
      deviceID: deviceID,
      rawSoilMoisture: rawSoilMoisture,
      timestamp: new Date()
    };

    console.log('✅ Prepared prediction data:', predictionData);

    res.json({
      success: true,
      message: 'Data prepared for prediction',
      sensorData: latestReading,
      predictionData: predictionData,
      assignment: {
        id: assignment._id,
        AssignmentID: assignment.AssignmentID
      },
      plant: {
        id: plant._id,
        name: plant.PlantName || plant.plantName
      },
      soilMoistureConversion: {
        raw: rawSoilMoisture,
        percent: soilMoisturePercent
      }
    });

  } catch (error) {
    console.error('❌ Error preparing for prediction:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.stack
    });
  }
});

// Get sensor readings for a specific device
router.get('/device/:deviceID', async (req, res) => {
  try {
    const { deviceID } = req.params;
    const { limit = 100, hours = 24 } = req.query;
    
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    const readings = await SensorData.find({
      DeviceID: deviceID,
      timestamp: { $gte: cutoffTime }
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit));
    
    res.json({
      success: true,
      count: readings.length,
      data: readings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get sensor readings for a specific plant
router.get('/plant/:plantID', async (req, res) => {
  try {
    const { plantID } = req.params;
    const { limit = 100, hours = 24 } = req.query;
    
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    const readings = await SensorData.find({
      plantID: plantID,
      timestamp: { $gte: cutoffTime }
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit));
    
    res.json({
      success: true,
      count: readings.length,
      data: readings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get all sensor readings with filters
router.get('/', async (req, res) => {
  try {
    const { 
      limit = 50, 
      userID, 
      deviceID, 
      plantID,
      assignmentID,
      source,
      hours = 24 
    } = req.query;
    
    let query = {};
    
    // Build query based on parameters
    if (userID) query.userID = userID;
    if (deviceID) query.DeviceID = deviceID;
    if (plantID) query.plantID = plantID;
    if (assignmentID) query.AssignmentID = assignmentID;
    if (source) query['metadata.source'] = source;
    
    // Add time filter if hours specified
    if (hours && hours !== 'all') {
      const cutoffTime = new Date(Date.now() - (parseInt(hours) * 60 * 60 * 1000));
      query.timestamp = { $gte: cutoffTime };
    }
    
    const readings = await SensorData.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    // Get summary statistics
    const stats = {
      total: await SensorData.countDocuments(query),
      bySource: {
        direct: await SensorData.countDocuments({ ...query, 'metadata.source': 'direct' }),
        thingspeak: await SensorData.countDocuments({ ...query, 'metadata.source': 'thingspeak' }),
        manual: await SensorData.countDocuments({ ...query, 'metadata.source': 'manual' })
      }
    };
    
    res.json({
      success: true,
      count: readings.length,
      total: stats.total,
      stats: stats,
      data: readings
    });
  } catch (error) {
    console.error('❌ Error fetching sensor data:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get latest readings summary
router.get('/summary', async (req, res) => {
  try {
    const { userID } = req.query;
    
    let query = {};
    if (userID) query.userID = userID;
    
    // Get latest reading for each device
    const devices = await SensorData.aggregate([
      { $match: query },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$DeviceID",
          latest: { $first: "$$ROOT" },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get latest reading for each plant
    const plants = await SensorData.aggregate([
      { $match: query },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: "$plantID",
          latest: { $first: "$$ROOT" },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get overall statistics
    const totalReadings = await SensorData.countDocuments(query);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayReadings = await SensorData.countDocuments({
      ...query,
      timestamp: { $gte: today }
    });
    
    res.json({
      success: true,
      summary: {
        totalReadings,
        todayReadings,
        uniqueDevices: devices.length,
        uniquePlants: plants.length,
        devices: devices.map(d => ({
          deviceID: d._id,
          latestReading: d.latest,
          totalReadings: d.count
        })),
        plants: plants.map(p => ({
          plantID: p._id,
          latestReading: p.latest,
          totalReadings: p.count
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error getting summary:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get latest sensor reading for a device
router.get('/device/:deviceID/latest', async (req, res) => {
  try {
    const { deviceID } = req.params;
    
    const latestReading = await SensorData.findOne({
      DeviceID: deviceID
    })
    .sort({ createdAt: -1 })
    .limit(1);
    
    if (!latestReading) {
      return res.status(404).json({
        success: false,
        message: "No sensor data found for this device"
      });
    }
    
    res.json({
      success: true,
      data: latestReading
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get latest sensor reading for a plant
router.get('/plant/:plantID/latest', async (req, res) => {
  try {
    const { plantID } = req.params;
    
    const latestReading = await SensorData.findOne({
      plantID: plantID
    })
    .sort({ createdAt: -1 })
    .limit(1);
    
    if (!latestReading) {
      return res.status(404).json({
        success: false,
        message: "No sensor data found for this plant"
      });
    }
    
    res.json({
      success: true,
      data: latestReading
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get sensor statistics
router.get('/stats', async (req, res) => {
  try {
    const { userID, plantID, deviceID, days = 7 } = req.query;
    
    let matchQuery = {};
    if (userID) matchQuery.userID = userID;
    if (plantID) matchQuery.plantID = plantID;
    if (deviceID) matchQuery.DeviceID = deviceID;
    
    // Date range
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    matchQuery.createdAt = { $gte: startDate };
    
    const stats = await SensorData.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalReadings: { $sum: 1 },
          avgTemperature: { $avg: "$temperature" },
          avgHumidity: { $avg: "$humidity" },
          avgSoilMoisture: { $avg: "$soilMoisture" },
          avgLightIntensity: { $avg: "$lightIntensity" },
          minTemperature: { $min: "$temperature" },
          maxTemperature: { $max: "$temperature" },
          minHumidity: { $min: "$humidity" },
          maxHumidity: { $max: "$humidity" }
        }
      }
    ]);
    
    res.json({
      success: true,
      period: `${days} days`,
      stats: stats[0] || {
        totalReadings: 0,
        avgTemperature: 0,
        avgHumidity: 0,
        avgSoilMoisture: 0,
        avgLightIntensity: 0
      }
    });
  } catch (error) {
    console.error('❌ Error getting sensor stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: "Sensor routes are running",
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /add - Add manual sensor reading',
      'POST /submit - Submit sensor data from device',
      'POST /fetch-thingspeak - Fetch from ThingSpeak',
      'POST /prepare-for-prediction - Prepare data for ML prediction',
      'GET /device/:deviceID - Get device readings',
      'GET /plant/:plantID - Get plant readings',
      'GET / - Get all readings with filters',
      'GET /summary - Get summary',
      'GET /stats - Get statistics'
    ]
  });
});

module.exports = router;