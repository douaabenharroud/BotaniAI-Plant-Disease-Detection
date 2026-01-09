const Prediction = require('../models/Prediction');
const DeviceAssignment = require('../models/DeviceAssignment');
const SensorReading = require('../models/SensorReading');
const axios = require('axios');

class PredictionController {
  constructor() {
    this.ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000/predict';
    this.ML_SERVICE_ENABLED = process.env.ML_SERVICE_ENABLED === 'true';
    this.PREDICTION_INTERVAL_HOURS = parseInt(process.env.PREDICTION_INTERVAL_HOURS) || 1;
    this.PREDICTION_INTERVAL = this.PREDICTION_INTERVAL_HOURS * 60 * 60 * 1000;
    this.checkInterval = null;
    
    console.log(`🤖 Prediction Controller Initialized:`);
    console.log(`   Auto-predictions: ${this.ML_SERVICE_ENABLED ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   Interval: ${this.PREDICTION_INTERVAL_HOURS} hour(s)`);
    console.log(`   ML Service: ${this.ML_API_URL}`);
  }

  init() {
    if (!this.ML_SERVICE_ENABLED) {
      console.log('⚠️ Auto-predictions disabled in configuration');
      return;
    }
    
    // Run periodic predictions
    this.checkInterval = setInterval(() => {
      this.runPeriodicPredictions();
    }, this.PREDICTION_INTERVAL);

    // Run immediately on startup (after delay)
    setTimeout(() => {
      console.log('🔍 Running initial predictions check...');
      this.runPeriodicPredictions();
    }, 15000); // Wait 15 seconds after server starts

    console.log(`✅ Prediction scheduler initialized (every ${this.PREDICTION_INTERVAL_HOURS} hour(s))`);
  }

  async runPeriodicPredictions() {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🤖 AUTO-PREDICTION RUN (${new Date().toLocaleTimeString()})`);
    console.log(`${'='.repeat(60)}`);
    
    try {
      // Get all active device assignments with sensors
      const assignments = await DeviceAssignment.find({ 
        status: 'active'
      }).populate('plantID');
      
      console.log(`📊 Found ${assignments.length} active assignments`);
      
      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      for (const assignment of assignments) {
        try {
          const result = await this.predictForAssignment(assignment);
          
          if (result.status === 'success') {
            successCount++;
            console.log(`✅ ${assignment.AssignmentID}: ${result.message}`);
          } else if (result.status === 'skipped') {
            skippedCount++;
            console.log(`⏭️ ${assignment.AssignmentID}: ${result.message}`);
          } else {
            errorCount++;
            console.log(`❌ ${assignment.AssignmentID}: ${result.message}`);
          }
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Error for ${assignment.AssignmentID}:`, error.message);
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`${'='.repeat(60)}`);
      console.log(`📈 AUTO-PREDICTION SUMMARY:`);
      console.log(`   ✅ Success: ${successCount}`);
      console.log(`   ⏭️ Skipped: ${skippedCount}`);
      console.log(`   ❌ Errors: ${errorCount}`);
      console.log(`   ⏱️ Duration: ${duration}ms`);
      console.log(`${'='.repeat(60)}\n`);
      
    } catch (error) {
      console.error('❌ Fatal error in auto-predictions:', error);
    }
  }

  async predictForAssignment(assignment) {
    try {
      // Check if assignment has recent sensor data (last 2 hours)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const recentReadings = await SensorReading.find({
        AssignmentID: assignment.AssignmentID,
        timestamp: { $gte: twoHoursAgo }
      });
      
      if (recentReadings.length === 0) {
        return {
          status: 'skipped',
          message: 'No recent sensor data (last 2 hours)'
        };
      }
      
      // Check if prediction already exists for this period (last 2 hours)
      const existingPrediction = await Prediction.findOne({
        deviceAssignmentID: assignment.AssignmentID,
        createdAt: { $gte: twoHoursAgo }
      });
      
      if (existingPrediction) {
        return {
          status: 'skipped',
          message: `Prediction exists from ${existingPrediction.createdAt.toLocaleTimeString()}`
        };
      }
      
      // Calculate averages from recent readings
      const sensorAverages = this.calculateSensorAverages(recentReadings);
      
      // Get plant info
      const plantType = assignment.plantID?.species || 'general';
      const plantAge = assignment.plantID?.ageDays || 30;
      
      // Prepare features
      const features = {
        Height_cm: await this.estimateHeight(assignment.plantID._id, plantType, plantAge),
        Leaf_Count: await this.estimateLeafCount(assignment.plantID._id, plantType, plantAge),
        New_Growth_Count: this.estimateNewGrowth(plantType, sensorAverages.temperature),
        Watering_Amount_ml: this.calculateWateringAmount(plantType, plantAge, sensorAverages.soilMoisturePercent),
        Watering_Frequency_days: this.getWateringFrequency(plantType, sensorAverages.temperature),
        Room_Temperature_C: sensorAverages.temperature || 23,
        "Humidity_%": sensorAverages.humidity || 55,
        "Soil_Moisture_%": sensorAverages.soilMoisturePercent || 50
      };
      
      // Call ML service
      const mlResponse = await axios.post(this.ML_API_URL, features, {
        timeout: 10000
      });
      
      // Save prediction
      await Prediction.create({
        ...features,
        deviceAssignmentID: assignment.AssignmentID,
        userID: assignment.userID,
        plantID: assignment.plantID._id,
        prediction_result: mlResponse.data.prediction,
        prediction_label: mlResponse.data.prediction_label,
        recommendation: mlResponse.data.recommendation,
        confidence_score: mlResponse.data.confidence || 0.85,
        sensorReadingID: recentReadings[0]._id,
        sensor_data_count: recentReadings.length,
        metadata: {
          source: 'auto_scheduled',
          model_type: mlResponse.data.model_type,
          using_fallback: mlResponse.data.using_fallback || false,
          sensor_timestamp: recentReadings[0].timestamp,
          sensor_readings_used: recentReadings.length
        }
      });
      
      return {
        status: 'success',
        message: `Class ${mlResponse.data.prediction} - ${mlResponse.data.recommendation.substring(0, 50)}...`
      };
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.response?.status === 503) {
        // Create fallback prediction
        await this.createFallbackPrediction(assignment, recentReadings);
        return {
          status: 'success',
          message: 'Created fallback prediction (ML service down)'
        };
      }
      
      throw error;
    }
  }

  // Helper methods (same as in routes/prediction.js)
  calculateSensorAverages(readings) {
    // ... same as before ...
  }
  
  estimateHeight(plantID, plantType, ageDays) {
    // ... same as before ...
  }
  
  // ... include all other helper methods from the routes file ...
}

module.exports = new PredictionController();