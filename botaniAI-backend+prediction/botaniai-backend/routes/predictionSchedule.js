const express = require('express');
const router = express.Router();
const predictionController = require('../controllers/predictionController');

// Trigger manual prediction run
router.post('/trigger', async (req, res) => {
  try {
    await predictionController.runPeriodicPredictions();
    res.json({
      success: true,
      message: 'Manual prediction triggered successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to trigger predictions',
      error: error.message
    });
  }
});

// Trigger prediction for specific assignment
router.post('/trigger/:assignmentId', async (req, res) => {
  try {
    const prediction = await predictionController.triggerManualPrediction(req.params.assignmentId);
    res.json({
      success: true,
      message: 'Prediction completed',
      data: prediction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate prediction',
      error: error.message
    });
  }
});

// Force prediction for specific assignment (skip recent check)
router.post('/force/:assignmentId', async (req, res) => {
  try {
    const prediction = await predictionController.forcePrediction(req.params.assignmentId);
    res.json({
      success: true,
      message: 'Forced prediction completed',
      data: prediction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to force prediction',
      error: error.message
    });
  }
});

// Get prediction history
router.get('/history/:plantID', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await predictionController.getPredictionHistory(req.params.plantID, limit);
    
    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prediction history',
      error: error.message
    });
  }
});

// Get prediction with sensor data
router.get('/with-sensor/:predictionId', async (req, res) => {
  try {
    const data = await predictionController.getPredictionWithSensorData(req.params.predictionId);
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Prediction not found'
      });
    }
    
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prediction with sensor data',
      error: error.message
    });
  }
});

// Get prediction statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await predictionController.getPredictionStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prediction statistics',
      error: error.message
    });
  }
});

// Cleanup old predictions
router.post('/cleanup', async (req, res) => {
  try {
    const result = await predictionController.cleanupOldPredictions();
    res.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} old predictions`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup predictions',
      error: error.message
    });
  }
});

// Get prediction status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Prediction scheduler is running',
    ml_service: process.env.ML_API_URL || 'Not configured',
    interval: `${process.env.PREDICTION_INTERVAL_MINUTES || 60} minute(s)`,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;