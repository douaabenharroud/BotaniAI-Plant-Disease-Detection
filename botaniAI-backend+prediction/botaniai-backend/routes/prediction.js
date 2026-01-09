const express = require('express');
const router = express.Router();
const axios = require('axios');

const Prediction = require('../models/Prediction');
const DeviceAssignment = require('../models/DeviceAssignment');
const SensorReading = require('../models/SensorReading');
const Plant = require('../models/Plant');

// Configuration from .env
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000/predict';
const ML_SERVICE_ENABLED = process.env.ML_SERVICE_ENABLED === 'true';
const PREDICTION_RETENTION_DAYS = parseInt(process.env.PREDICTION_RETENTION_DAYS) || 3;

console.log(`🌱 ML Service Configuration:`);
console.log(`   URL: ${ML_API_URL}`);
console.log(`   Enabled: ${ML_SERVICE_ENABLED}`);
console.log(`   Retention: ${PREDICTION_RETENTION_DAYS} days`);

// POST /api/predict - Main endpoint
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🌱 PREDICTION REQUEST ${requestId}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`⏰ Start time: ${new Date().toISOString()}`);

  try {
    // 1) Log request
    console.log(`📥 Request Body:`, JSON.stringify(req.body, null, 2));

    // 2) Validate required fields
    const validation = validatePredictionRequest(req.body);
    if (!validation.valid) {
      console.log(`❌ Validation failed: ${validation.message}`);
      return res.status(422).json({
        success: false,
        message: validation.message,
        request_id: requestId
      });
    }

    // 3) Get assignment
    const assignment = await DeviceAssignment.findById(req.body.deviceAssignmentID);
    if (!assignment) {
      console.log(`❌ Assignment not found: ${req.body.deviceAssignmentID}`);
      return res.status(404).json({
        success: false,
        message: "Device assignment not found",
        request_id: requestId
      });
    }

    console.log(`📌 Assignment found:`);
    console.log(`   - ID: ${assignment.AssignmentID}`);
    console.log(`   - User: ${assignment.userID}`);
    console.log(`   - Plant: ${assignment.plantID}`);
    console.log(`   - Device: ${assignment.DeviceID}`);
    console.log(`   - Status: ${assignment.status}`);

    // 4) Get latest sensor data (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sensorReadings = await SensorReading.find({
      AssignmentID: assignment.AssignmentID,
      timestamp: { $gte: twentyFourHoursAgo }
    }).sort({ timestamp: -1 }).limit(10);

    console.log(`📊 Sensor data: Found ${sensorReadings.length} readings in last 24h`);
    
    if (sensorReadings.length > 0) {
      console.log(`   Latest: ${sensorReadings[0].timestamp.toISOString()}`);
      console.log(`   Temp: ${sensorReadings[0].temperature}°C`);
      console.log(`   Humid: ${sensorReadings[0].humidity}%`);
      console.log(`   Soil: ${sensorReadings[0].soilMoisture} (raw)`);
    }

    // 5) Get plant info for intelligent defaults
    const plant = await Plant.findById(assignment.plantID);
    const plantType = plant?.species || 'unknown';
    const plantAgeDays = plant?.ageDays || 30;
    
    console.log(`🌿 Plant info: ${plantType}, Age: ${plantAgeDays} days`);

    // 6) Prepare ML features
    const features = await prepareMLFeatures({
      userInput: req.body,
      sensorReadings,
      plantType,
      plantAgeDays,
      assignment
    });

    console.log(`🎯 ML Features prepared:`, JSON.stringify(features, null, 2));

    // 7) Check ML service availability
    if (!ML_SERVICE_ENABLED) {
      console.log(`⚠️ ML Service disabled in config, using fallback`);
      return handleFallbackPrediction(features, assignment, sensorReadings, req, res, requestId);
    }

    // 8) Call ML Service
    console.log(`🤖 Calling ML Service...`);
    console.log(`   URL: ${ML_API_URL}`);
    
    let mlResponse;
    try {
      mlResponse = await axios.post(ML_API_URL, features, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        }
      });
      
      console.log(`✅ ML Service responded in ${mlResponse.headers['x-response-time'] || 'unknown'}ms`);
      console.log(`📊 ML Response:`, JSON.stringify(mlResponse.data, null, 2));
      
    } catch (mlError) {
      console.error(`❌ ML Service error:`, mlError.message);
      
      if (mlError.code === 'ECONNREFUSED' || mlError.code === 'ETIMEDOUT') {
        console.log(`🔄 Falling back to local prediction`);
        return handleFallbackPrediction(features, assignment, sensorReadings, req, res, requestId);
      }
      
      throw mlError;
    }

    // 9) Save prediction
    const savedPrediction = await savePredictionToDB({
      features,
      assignment,
      mlResult: mlResponse.data,
      sensorReadings,
      userInput: req.body,
      requestId,
      metadata: {
        source: 'ml_service',
        model_type: mlResponse.data.model_type,
        confidence: mlResponse.data.confidence,
        using_fallback: mlResponse.data.using_fallback || false
      }
    });

    console.log(`💾 Prediction saved: ${savedPrediction._id}`);

    // 10) Return success response
    const processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      message: "Plant health prediction completed successfully",
      request_id: requestId,
      processing_time_ms: processingTime,
      prediction: {
        class: mlResponse.data.prediction,
        label: mlResponse.data.prediction_label || `Class ${mlResponse.data.prediction}`,
        description: getPredictionDescription(mlResponse.data.prediction),
        recommendation: mlResponse.data.recommendation,
        confidence: mlResponse.data.confidence || 0.85
      },
      data_used: {
        sensor_readings_count: sensorReadings.length,
        has_latest_sensor: sensorReadings.length > 0,
        latest_sensor_timestamp: sensorReadings[0]?.timestamp,
        used_manual_inputs: {
          height: req.body.Height_cm ? true : false,
          leaf_count: req.body.Leaf_Count ? true : false,
          new_growth: req.body.New_Growth_Count ? true : false,
          watering: req.body.Watering_Amount_ml ? true : false
        }
      },
      references: {
        prediction_id: savedPrediction._id,
        plant_id: assignment.plantID,
        user_id: assignment.userID,
        device_assignment_id: assignment.AssignmentID,
        timestamp: savedPrediction.createdAt
      }
    });

    console.log(`✅ Prediction completed in ${processingTime}ms`);
    console.log(`${'='.repeat(70)}\n`);

  } catch (error) {
    console.error(`❌ Critical error in prediction ${requestId}:`, error.message);
    console.error(`Stack trace:`, error.stack);
    
    const processingTime = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      message: "Prediction failed due to server error",
      request_id: requestId,
      processing_time_ms: processingTime,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
    
    console.log(`❌ Failed in ${processingTime}ms`);
    console.log(`${'='.repeat(70)}\n`);
  }
});

// ==================== HELPER FUNCTIONS ====================

function validatePredictionRequest(body) {
  if (!body.deviceAssignmentID) {
    return { valid: false, message: "Missing required field: deviceAssignmentID" };
  }
  
  // Check if at least one of sensor data or manual inputs is provided
  const hasManualInputs = body.Height_cm || body.Leaf_Count || body.New_Growth_Count;
  const hasDeviceAssignment = body.deviceAssignmentID;
  
  if (!hasManualInputs && !hasDeviceAssignment) {
    return { 
      valid: false, 
      message: "Either provide manual plant data (Height_cm, Leaf_Count, etc.) or deviceAssignmentID for sensor data" 
    };
  }
  
  return { valid: true, message: "Validation passed" };
}

async function prepareMLFeatures({ userInput, sensorReadings, plantType, plantAgeDays, assignment }) {
  // Calculate averages from sensor readings
  const sensorAverages = calculateSensorAverages(sensorReadings);
  
  // Get intelligent defaults based on plant type
  const plantDefaults = getPlantDefaults(plantType, plantAgeDays);
  
  // Prepare features object
  const features = {
    Height_cm: userInput.Height_cm || 
               await estimateHeight(assignment.plantID, plantType, plantAgeDays) || 
               plantDefaults.height,
    
    Leaf_Count: userInput.Leaf_Count || 
                await estimateLeafCount(assignment.plantID, plantType, plantAgeDays) || 
                plantDefaults.leafCount,
    
    New_Growth_Count: userInput.New_Growth_Count || 
                      estimateNewGrowth(plantType, sensorAverages.temperature) || 
                      plantDefaults.newGrowth,
    
    Watering_Amount_ml: userInput.Watering_Amount_ml || 
                        calculateWateringAmount(plantType, plantAgeDays, sensorAverages.soilMoisturePercent),
    
    Watering_Frequency_days: userInput.Watering_Frequency_days || 
                             getWateringFrequency(plantType, sensorAverages.temperature),
    
    Room_Temperature_C: sensorAverages.temperature || 
                       userInput.Room_Temperature_C || 
                       plantDefaults.temperature,
    
    "Humidity_%": sensorAverages.humidity || 
                  userInput.Humidity_percent || 
                  plantDefaults.humidity,
    
    "Soil_Moisture_%": sensorAverages.soilMoisturePercent || 
                       userInput.Soil_Moisture_percent || 
                       plantDefaults.soilMoisture
  };

  // Round values
  Object.keys(features).forEach(key => {
    if (typeof features[key] === 'number') {
      features[key] = Math.round(features[key] * 10) / 10;
    }
  });

  return features;
}

function calculateSensorAverages(readings) {
  if (readings.length === 0) {
    return {
      temperature: null,
      humidity: null,
      soilMoisture: null,
      soilMoisturePercent: null,
      readingCount: 0
    };
  }

  let tempSum = 0, humidSum = 0, soilSum = 0;
  let tempCount = 0, humidCount = 0, soilCount = 0;

  readings.forEach(reading => {
    if (reading.temperature != null) {
      tempSum += reading.temperature;
      tempCount++;
    }
    if (reading.humidity != null) {
      humidSum += reading.humidity;
      humidCount++;
    }
    if (reading.soilMoisture != null) {
      soilSum += reading.soilMoisture;
      soilCount++;
    }
  });

  const avgTemp = tempCount > 0 ? tempSum / tempCount : null;
  const avgHumid = humidCount > 0 ? humidSum / humidCount : null;
  const avgSoil = soilCount > 0 ? soilSum / soilCount : null;
  const avgSoilPercent = avgSoil !== null ? convertSoilMoistureToPercent(avgSoil) : null;

  return {
    temperature: avgTemp,
    humidity: avgHumid,
    soilMoisture: avgSoil,
    soilMoisturePercent: avgSoilPercent,
    readingCount: readings.length
  };
}

function getPlantDefaults(plantType, ageDays) {
  const defaults = {
    succulent: {
      height: Math.min(30, 5 + (ageDays * 0.1)),
      leafCount: Math.min(50, 3 + (ageDays * 0.15)),
      newGrowth: Math.min(5, Math.floor(ageDays / 30)),
      temperature: 24,
      humidity: 40,
      soilMoisture: 30,
      waterFrequency: 14
    },
    fern: {
      height: Math.min(60, 10 + (ageDays * 0.2)),
      leafCount: Math.min(100, 5 + (ageDays * 0.3)),
      newGrowth: Math.min(10, Math.floor(ageDays / 20)),
      temperature: 22,
      humidity: 70,
      soilMoisture: 60,
      waterFrequency: 3
    },
    monstera: {
      height: Math.min(120, 15 + (ageDays * 0.3)),
      leafCount: Math.min(30, 2 + (ageDays * 0.1)),
      newGrowth: Math.min(8, Math.floor(ageDays / 45)),
      temperature: 25,
      humidity: 60,
      soilMoisture: 50,
      waterFrequency: 7
    },
    general: {
      height: Math.min(50, 8 + (ageDays * 0.15)),
      leafCount: Math.min(40, 4 + (ageDays * 0.2)),
      newGrowth: Math.min(6, Math.floor(ageDays / 25)),
      temperature: 23,
      humidity: 55,
      soilMoisture: 45,
      waterFrequency: 5
    }
  };

  return defaults[plantType.toLowerCase()] || defaults.general;
}

async function estimateHeight(plantID, plantType, ageDays) {
  // In a real app, get from plant growth history
  try {
    const recentPredictions = await Prediction.find({ plantID })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('Height_cm createdAt');
    
    if (recentPredictions.length > 0) {
      const lastHeight = recentPredictions[0].Height_cm;
      // Estimate 0.1cm growth per day
      const daysSinceLast = (Date.now() - recentPredictions[0].createdAt) / (1000 * 60 * 60 * 24);
      return lastHeight + (daysSinceLast * 0.1);
    }
  } catch (error) {
    console.log(`⚠️ Could not estimate height: ${error.message}`);
  }
  
  return getPlantDefaults(plantType, ageDays).height;
}

async function estimateLeafCount(plantID, plantType, ageDays) {
  try {
    const recentPredictions = await Prediction.find({ plantID })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('Leaf_Count createdAt');
    
    if (recentPredictions.length > 0) {
      return recentPredictions[0].Leaf_Count;
    }
  } catch (error) {
    console.log(`⚠️ Could not estimate leaf count: ${error.message}`);
  }
  
  return getPlantDefaults(plantType, ageDays).leafCount;
}

function estimateNewGrowth(plantType, temperature) {
  const defaults = getPlantDefaults(plantType, 30);
  if (!temperature) return defaults.newGrowth;
  
  // More new growth in optimal temperature
  if (temperature >= 20 && temperature <= 28) {
    return defaults.newGrowth + 1;
  }
  return defaults.newGrowth;
}

function calculateWateringAmount(plantType, ageDays, soilMoisture) {
  const defaults = getPlantDefaults(plantType, ageDays);
  
  let baseAmount = 250; // ml
  
  // Adjust based on plant type
  if (plantType.toLowerCase() === 'succulent') baseAmount = 100;
  if (plantType.toLowerCase() === 'fern') baseAmount = 300;
  if (plantType.toLowerCase() === 'monstera') baseAmount = 200;
  
  // Adjust based on soil moisture
  if (soilMoisture !== null) {
    if (soilMoisture < 30) baseAmount *= 1.5; // Very dry
    if (soilMoisture > 70) baseAmount *= 0.5; // Very wet
  }
  
  return Math.round(baseAmount / 50) * 50; // Round to nearest 50ml
}

function getWateringFrequency(plantType, temperature) {
  const defaults = getPlantDefaults(plantType, 30);
  let frequency = defaults.waterFrequency;
  
  // Adjust based on temperature
  if (temperature !== null) {
    if (temperature > 28) frequency *= 0.7; // Water more often when hot
    if (temperature < 18) frequency *= 1.3; // Water less often when cold
  }
  
  return Math.round(frequency * 10) / 10; // One decimal place
}

function convertSoilMoistureToPercent(sensorValue) {
  if (sensorValue === null || sensorValue === undefined) return 50;
  
  // Common sensor ranges
  // Dry: 0-300, Moist: 300-700, Wet: 700-1000
  const percent = Math.round((sensorValue / 1000) * 100);
  return Math.min(100, Math.max(0, percent));
}

async function handleFallbackPrediction(features, assignment, sensorReadings, req, res, requestId) {
  console.log(`🔄 Using fallback prediction logic`);
  
  // Simple rule-based prediction
  let predictionClass = 4; // Default: GOOD
  
  const temp = features.Room_Temperature_C;
  const humid = features["Humidity_%"];
  const soil = features["Soil_Moisture_%"];
  
  // Basic rules
  if (soil < 30) predictionClass = 0; // Needs water
  else if (soil > 80) predictionClass = 1; // Overwatered
  else if (temp < 15 || temp > 30) predictionClass = 2; // Temperature stress
  else if (humid < 30 || humid > 70) predictionClass = 3; // Humidity stress
  else if (features.Leaf_Count < 5) predictionClass = 2; // Poor growth
  else predictionClass = 4; // Good
  
  const recommendation = getPredictionDescription(predictionClass);
  
  // Save fallback prediction
  const savedPrediction = await savePredictionToDB({
    features,
    assignment,
    mlResult: {
      prediction: predictionClass,
      prediction_label: `Class ${predictionClass}`,
      recommendation: recommendation,
      confidence: 0.7,
      using_fallback: true,
      model_type: 'fallback_rules'
    },
    sensorReadings,
    userInput: req.body,
    requestId,
    metadata: {
      source: 'fallback',
      model_type: 'rule_based',
      confidence: 0.7,
      using_fallback: true,
      reason: 'ML service unavailable'
    }
  });
  
  res.json({
    success: true,
    message: "Prediction completed using fallback rules (ML service unavailable)",
    request_id: requestId,
    prediction: {
      class: predictionClass,
      label: `Class ${predictionClass}`,
      description: recommendation.split('.')[0] + '.',
      recommendation: recommendation,
      confidence: 0.7,
      is_fallback: true
    },
    data_used: {
      sensor_readings_count: sensorReadings.length,
      has_latest_sensor: sensorReadings.length > 0,
      used_manual_inputs: {
        height: req.body.Height_cm ? true : false,
        leaf_count: req.body.Leaf_Count ? true : false,
        new_growth: req.body.New_Growth_Count ? true : false
      }
    },
    references: {
      prediction_id: savedPrediction._id,
      plant_id: assignment.plantID,
      device_assignment_id: assignment.AssignmentID
    },
    note: "This prediction uses rule-based fallback logic. For more accurate predictions, ensure the ML service is running."
  });
}

async function savePredictionToDB({ features, assignment, mlResult, sensorReadings, userInput, requestId, metadata }) {
  const predictionData = {
    // Features
    Height_cm: features.Height_cm,
    Leaf_Count: features.Leaf_Count,
    New_Growth_Count: features.New_Growth_Count,
    Watering_Amount_ml: features.Watering_Amount_ml,
    Watering_Frequency_days: features.Watering_Frequency_days,
    Room_Temperature_C: features.Room_Temperature_C,
    Humidity_percent: features["Humidity_%"],
    Soil_Moisture_percent: features["Soil_Moisture_%"],
    
    // References
    deviceAssignmentID: assignment.AssignmentID,
    userID: assignment.userID,
    plantID: assignment.plantID,
    
    // Results
    prediction_result: mlResult.prediction,
    prediction_label: mlResult.prediction_label || `Class ${mlResult.prediction}`,
    recommendation: mlResult.recommendation,
    confidence_score: mlResult.confidence || 0.85,
    
    // Sensor reference
    sensorReadingID: sensorReadings[0]?._id,
    sensor_data_count: sensorReadings.length,
    
    // Metadata
    request_id: requestId,
    metadata: {
      ...metadata,
      sensor_timestamp: sensorReadings[0]?.timestamp,
      has_manual_inputs: userInput.Height_cm || userInput.Leaf_Count || userInput.New_Growth_Count,
      manual_inputs_provided: {
        Height_cm: userInput.Height_cm ? true : false,
        Leaf_Count: userInput.Leaf_Count ? true : false,
        New_Growth_Count: userInput.New_Growth_Count ? true : false,
        Watering_Amount_ml: userInput.Watering_Amount_ml ? true : false,
        Watering_Frequency_days: userInput.Watering_Frequency_days ? true : false
      }
    }
  };

  return await Prediction.create(predictionData);
}

function getPredictionDescription(predictionClass) {
  const descriptions = {
    0: "🚨 CRITICAL - Plant needs immediate attention! Check water, light, and temperature urgently.",
    1: "🔴 POOR - Plant health is declining. Adjust care routine and monitor closely.",
    2: "🟠 FAIR - Plant is struggling. Needs better conditions and regular care.",
    3: "🟡 AVERAGE - Plant is doing okay but could be better. Minor adjustments needed.",
    4: "🟢 GOOD - Plant is healthy and growing well. Maintain current care.",
    5: "✅ EXCELLENT - Plant is thriving in optimal conditions! Keep up the good work!"
  };
  
  return descriptions[predictionClass] || "Monitor plant conditions regularly.";
}

// ==================== ADDITIONAL ENDPOINTS ====================

// GET latest predictions for a plant
router.get('/plant/:plantID/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const predictions = await Prediction.find({ plantID: req.params.plantID })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-__v');
    
    res.json({
      success: true,
      count: predictions.length,
      data: predictions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch predictions",
      error: error.message
    });
  }
});

// GET prediction by ID
router.get('/:predictionID', async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.predictionID);
    
    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: "Prediction not found"
      });
    }
    
    // Get associated sensor reading if available
    let sensorData = null;
    if (prediction.sensorReadingID) {
      sensorData = await SensorReading.findById(prediction.sensorReadingID);
    }
    
    res.json({
      success: true,
      data: {
        prediction,
        sensor_data: sensorData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch prediction",
      error: error.message
    });
  }
});

// GET prediction statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const totalPredictions = await Prediction.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPredictions = await Prediction.countDocuments({ createdAt: { $gte: today } });
    
    // Class distribution
    const classDistribution = {};
    for (let i = 0; i <= 5; i++) {
      classDistribution[i] = await Prediction.countDocuments({ prediction_result: i });
    }
    
    // Source distribution
    const sourceAggregation = await Prediction.aggregate([
      {
        $group: {
          _id: "$metadata.source",
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        total_predictions: totalPredictions,
        today_predictions: todayPredictions,
        class_distribution: classDistribution,
        source_distribution: sourceAggregation.reduce((acc, curr) => {
          acc[curr._id || 'unknown'] = curr.count;
          return acc;
        }, {}),
        ml_service_status: {
          enabled: ML_SERVICE_ENABLED,
          url: ML_API_URL
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message
    });
  }
});

// POST test endpoint (for development)
router.post('/test-ml', async (req, res) => {
  try {
    console.log("Testing ML service connection...");
    
    const testData = {
      Height_cm: 30.5,
      Leaf_Count: 15.0,
      New_Growth_Count: 3.0,
      Watering_Amount_ml: 250.0,
      Watering_Frequency_days: 2.5,
      Room_Temperature_C: 23.5,
      "Humidity_%": 55.0,
      "Soil_Moisture_%": 65.0
    };
    
    const response = await axios.post(ML_API_URL, testData, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    res.json({
      success: true,
      message: "ML service is responding correctly",
      ml_service: ML_API_URL,
      test_data: testData,
      response: response.data
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "ML service is not responding",
      ml_service: ML_API_URL,
      error: error.message
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: "Prediction API",
    ml_service: {
      enabled: ML_SERVICE_ENABLED,
      url: ML_API_URL,
      status: ML_SERVICE_ENABLED ? "configured" : "disabled"
    },
    database: "connected",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Cleanup old predictions (called by scheduler)
router.post('/cleanup', async (req, res) => {
  try {
    const retentionDays = PREDICTION_RETENTION_DAYS;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const result = await Prediction.deleteMany({
      createdAt: { $lt: cutoffDate }
    });
    
    console.log(`🧹 Cleaned up ${result.deletedCount} predictions older than ${retentionDays} days`);
    
    res.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} old predictions`,
      retention_days: retentionDays,
      cutoff_date: cutoffDate,
      deleted_count: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cleanup predictions",
      error: error.message
    });
  }
});

module.exports = router;