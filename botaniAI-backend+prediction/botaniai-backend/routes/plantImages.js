const express = require('express');
const PlantImage = require('../models/PlantImage');
const DeviceAssignment = require('../models/DeviceAssignment');
const { protect } = require('../middleware/auth');
const { generateID } = require('../utils/idGenerator');

const router = express.Router();

// Get all images for user's plants
router.get('/', protect, async (req, res) => {
  try {
    // Get user's plant assignments
    const assignments = await DeviceAssignment.find({ 
      userID: req.user.UserID,
      status: 'active'
    });

    const plantIDs = assignments.map(assignment => assignment.plantID);
    
    const images = await PlantImage.find({ 
      PlantID: { $in: plantIDs }
    })
    .sort({ timestamp: -1 })
    .limit(50); // Last 50 images

    res.json({
      success: true,
      count: images.length,
      data: images
    });
  } catch (error) {
    console.error('Get plant images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching plant images'
    });
  }
});

// Upload plant image
router.post('/upload', protect, async (req, res) => {
  try {
    const { PlantID, ImageURL } = req.body;

    // Check if user has access to this plant
    const assignment = await DeviceAssignment.findOne({
      plantID: PlantID,
      userID: req.user.UserID,
      status: 'active'
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found or access denied'
      });
    }

    const plantImage = new PlantImage({
      ImageID: generateID('img'),
      PlantID,
      ImageURL,
      timestamp: new Date()
    });

    await plantImage.save();

    // Run visual analysis
    await plantImage.runVisualAnalysis();

    res.status(201).json({
      success: true,
      data: plantImage,
      message: 'Image uploaded and analyzed successfully'
    });
  } catch (error) {
    console.error('Upload plant image error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading plant image'
    });
  }
});

// Get images for specific plant
router.get('/plant/:plantId', protect, async (req, res) => {
  try {
    const { plantId } = req.params;

    // Check if user has access to this plant
    const assignment = await DeviceAssignment.findOne({
      plantID: plantId,
      userID: req.user.UserID,
      status: 'active'
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found or access denied'
      });
    }

    const images = await PlantImage.find({ PlantID: plantId })
      .sort({ timestamp: -1 });

    // Calculate average health score from images
    const averageScore = images.length > 0 ? 
      images.reduce((sum, img) => sum + img.AnalysisScore, 0) / images.length : 0;

    res.json({
      success: true,
      data: {
        images,
        statistics: {
          totalImages: images.length,
          averageHealthScore: Math.round(averageScore * 10) / 10,
          latestAnalysis: images.length > 0 ? images[0].AnalysisScore : null
        }
      }
    });
  } catch (error) {
    console.error('Get plant images error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching plant images'
    });
  }
});

// Run analysis on existing image
router.post('/:imageId/analyze', protect, async (req, res) => {
  try {
    const plantImage = await PlantImage.findOne({ ImageID: req.params.imageId });

    if (!plantImage) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Check if user has access to this image
    const assignment = await DeviceAssignment.findOne({
      plantID: plantImage.PlantID,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Access denied to this image'
      });
    }

    await plantImage.runVisualAnalysis();

    res.json({
      success: true,
      data: plantImage,
      message: 'Image analysis completed successfully'
    });
  } catch (error) {
    console.error('Analyze image error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing image'
    });
  }
});

// Get image analysis trends
router.get('/plant/:plantId/trends', protect, async (req, res) => {
  try {
    const { plantId } = req.params;
    const { days = 30 } = req.query;

    // Check if user has access to this plant
    const assignment = await DeviceAssignment.findOne({
      plantID: plantId,
      userID: req.user.UserID,
      status: 'active'
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Plant not found or access denied'
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const images = await PlantImage.find({
      PlantID: plantId,
      timestamp: { $gte: startDate }
    })
    .sort({ timestamp: 1 })
    .select('timestamp AnalysisScore');

    // Calculate trends
    const trends = {
      totalImages: images.length,
      averageScore: images.length > 0 ? 
        images.reduce((sum, img) => sum + img.AnalysisScore, 0) / images.length : 0,
      scoreTrend: calculateScoreTrend(images),
      recentScores: images.slice(-5).map(img => ({
        score: img.AnalysisScore,
        date: img.timestamp
      }))
    };

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Get image trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching image trends'
    });
  }
});

function calculateScoreTrend(images) {
  if (images.length < 2) return 'insufficient_data';
  
  const firstHalf = images.slice(0, Math.floor(images.length / 2));
  const secondHalf = images.slice(Math.floor(images.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, img) => sum + img.AnalysisScore, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, img) => sum + img.AnalysisScore, 0) / secondHalf.length;
  
  const difference = secondAvg - firstAvg;
  
  if (Math.abs(difference) < 0.1) return 'stable';
  return difference > 0 ? 'improving' : 'declining';
}

module.exports = router;