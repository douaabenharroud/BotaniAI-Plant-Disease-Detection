const express = require('express');
const Analysis = require('../models/Analysis');
const Recommendations = require('../models/Recommendation');
const DeviceAssignment = require('../models/DeviceAssignment');
const SensorReading = require('../models/SensorReading');
const { protect } = require('../middleware/auth');
const { generateID } = require('../utils/idGenerator');

const router = express.Router();

// Get all analyses for user's plants
router.get('/', protect, async (req, res) => {
  try {
    // Get user's device assignments
    const assignments = await DeviceAssignment.find({ 
      userID: req.user.UserID,
      status: 'active'
    });

    const deviceIDs = assignments.map(assignment => assignment.SensorID);
    
    const analyses = await Analysis.find({ 
      deviceID: { $in: deviceIDs }
    })
    .sort({ TimeStamp: -1 })
    .limit(50); // Last 50 analyses

    res.json({
      success: true,
      count: analyses.length,
      data: analyses
    });
  } catch (error) {
    console.error('Get analyses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analyses'
    });
  }
});

// Get analysis by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const analysis = await Analysis.findOne({ AnalysisID: req.params.id });
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'Analysis not found'
      });
    }

    // Check if user has access to this analysis
    const assignment = await DeviceAssignment.findOne({
      SensorID: analysis.deviceID,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Access denied to this analysis'
      });
    }

    // Get related recommendations
    const recommendations = await Recommendations.find({ 
      analysisID: analysis.AnalysisID 
    });

    // Get the sensor reading that triggered this analysis
    const sensorReading = await SensorReading.findOne({
      deviceID: analysis.deviceID,
      timestamp: { $lte: analysis.TimeStamp }
    }).sort({ timestamp: -1 });

    res.json({
      success: true,
      data: {
        analysis,
        recommendations,
        sensorReading,
        plant: assignment.plantID
      }
    });
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analysis details'
    });
  }
});

// Run manual analysis for a device
router.post('/run-analysis', protect, async (req, res) => {
  try {
    const { deviceID } = req.body;

    // Check if user has access to this device
    const assignment = await DeviceAssignment.findOne({
      SensorID: deviceID,
      userID: req.user.UserID,
      status: 'active'
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    // Get latest sensor reading
    const latestReading = await SensorReading.findOne({
      deviceID: deviceID
    }).sort({ timestamp: -1 });

    if (!latestReading) {
      return res.status(404).json({
        success: false,
        message: 'No sensor data available for analysis'
      });
    }

    // Create and run analysis
    const analysis = new Analysis({
      AnalysisID: generateID('analysis'),
      deviceID: deviceID,
      TimeStamp: new Date()
    });

    await analysis.runAnalysis(latestReading);

    // Generate recommendations if needed
    let recommendations = [];
    if (analysis.HealthScore < 4 || analysis.anomalyDetected) {
      const recommendationText = generateRecommendation(analysis, latestReading);
      
      const recommendation = new Recommendations({
        recommendationID: generateID('rec'),
        analysisID: analysis.AnalysisID,
        text: recommendationText,
        priority: analysis.HealthScore <= 2 ? 1 : analysis.HealthScore === 3 ? 2 : 3,
        category: determineCategory(latestReading),
        type: analysis.anomalyDetected ? 'immediate' : 'informational'
      });

      await recommendation.save();
      recommendations.push(recommendation);
    }

    res.json({
      success: true,
      data: {
        analysis,
        recommendations,
        sensorReading: latestReading
      },
      message: 'Analysis completed successfully'
    });

  } catch (error) {
    console.error('Run analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error running analysis'
    });
  }
});

// Helper function to generate recommendations
function generateRecommendation(analysis, reading) {
  const issues = [];
  
  if (reading.temperature < 18) issues.push('temperature too low');
  if (reading.temperature > 28) issues.push('temperature too high');
  if (reading.humidity < 30) issues.push('humidity too low');
  if (reading.humidity > 70) issues.push('humidity too high');
  if (reading.soilMoisture < 1000) issues.push('soil too dry');
  if (reading.soilMoisture > 3000) issues.push('overwatering detected');
  if (reading.lightIntensity < 200) issues.push('insufficient light');

  if (issues.length === 0) {
    return `Plant health is good (Score: ${analysis.HealthScore}/5). Continue current care routine.`;
  }

  return `Health score: ${analysis.HealthScore}/5. Issues: ${issues.join(', ')}. ${getActionAdvice(issues)}`;
}

function determineCategory(reading) {
  if (reading.soilMoisture < 1000 || reading.soilMoisture > 3000) return 'watering';
  if (reading.lightIntensity < 200) return 'lighting';
  if (reading.temperature < 18 || reading.temperature > 28) return 'temperature';
  if (reading.humidity < 30 || reading.humidity > 70) return 'humidity';
  return 'general';
}

function getActionAdvice(issues) {
  const advice = [];
  
  if (issues.includes('soil too dry')) advice.push('Water the plant');
  if (issues.includes('overwatering detected')) advice.push('Reduce watering frequency');
  if (issues.includes('insufficient light')) advice.push('Move to brighter location');
  if (issues.includes('temperature too low')) advice.push('Move to warmer area');
  if (issues.includes('temperature too high')) advice.push('Move to cooler area');
  if (issues.includes('humidity too low')) advice.push('Increase humidity with misting');
  if (issues.includes('humidity too high')) advice.push('Improve air circulation');
  
  return advice.length > 0 ? `Recommended actions: ${advice.join(', ')}` : 'Monitor plant conditions.';
}

// Get analysis history for a device
router.get('/device/:deviceID/history', protect, async (req, res) => {
  try {
    const { deviceID } = req.params;
    const { days = 30 } = req.query;

    // Check if user has access to this device
    const assignment = await DeviceAssignment.findOne({
      SensorID: deviceID,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const analyses = await Analysis.find({
      deviceID: deviceID,
      TimeStamp: { $gte: startDate }
    })
    .sort({ TimeStamp: 1 })
    .select('TimeStamp HealthScore anomalyDetected confidenceScore');

    // Calculate statistics
    const stats = {
      totalAnalyses: analyses.length,
      averageHealthScore: analyses.length > 0 ? 
        analyses.reduce((sum, a) => sum + a.HealthScore, 0) / analyses.length : 0,
      anomalyCount: analyses.filter(a => a.anomalyDetected).length,
      trend: calculateHealthTrend(analyses)
    };

    res.json({
      success: true,
      data: {
        analyses,
        stats,
        period: `${days} days`
      }
    });
  } catch (error) {
    console.error('Get analysis history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analysis history'
    });
  }
});

function calculateHealthTrend(analyses) {
  if (analyses.length < 2) return 'insufficient_data';
  
  const firstHalf = analyses.slice(0, Math.floor(analyses.length / 2));
  const secondHalf = analyses.slice(Math.floor(analyses.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, a) => sum + a.HealthScore, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, a) => sum + a.HealthScore, 0) / secondHalf.length;
  
  const difference = secondAvg - firstAvg;
  
  if (Math.abs(difference) < 0.1) return 'stable';
  return difference > 0 ? 'improving' : 'declining';
}

module.exports = router;