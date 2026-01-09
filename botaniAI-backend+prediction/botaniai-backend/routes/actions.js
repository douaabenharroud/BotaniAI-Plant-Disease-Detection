const express = require('express');
const Action = require('../models/Action');
const DeviceAssignment = require('../models/DeviceAssignment');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get all actions for current user
router.get('/', protect, async (req, res) => {
  try {
    const { actionType, limit = 50 } = req.query;

    let query = { userID: req.user.UserID };
    
    if (actionType) {
      query.actionType = actionType;
    }

    const actions = await Action.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: actions.length,
      data: actions
    });
  } catch (error) {
    console.error('Get actions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching actions'
    });
  }
});

// Log a new action
router.post('/log', protect, async (req, res) => {
  try {
    const { deviceID, actionType, details } = req.body;

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

    const action = await Action.logAction(
      req.user.UserID,
      deviceID,
      actionType,
      details
    );

    res.status(201).json({
      success: true,
      data: action,
      message: 'Action logged successfully'
    });
  } catch (error) {
    console.error('Log action error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging action'
    });
  }
});

// Get actions by device
router.get('/device/:deviceId', protect, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 20 } = req.query;

    // Check if user has access to this device
    const assignment = await DeviceAssignment.findOne({
      SensorID: deviceId,
      userID: req.user.UserID
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Device not found or access denied'
      });
    }

    const actions = await Action.getActionsByDevice(deviceId)
      .limit(parseInt(limit));

    // Calculate statistics
    const stats = {
      totalActions: actions.length,
      actionTypes: actions.reduce((acc, action) => {
        acc[action.actionType] = (acc[action.actionType] || 0) + 1;
        return acc;
      }, {}),
      recentActivity: actions.slice(0, 5)
    };

    res.json({
      success: true,
      data: {
        actions,
        statistics: stats
      }
    });
  } catch (error) {
    console.error('Get device actions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching device actions'
    });
  }
});

// Get action statistics
router.get('/statistics', protect, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const actions = await Action.find({
      userID: req.user.UserID,
      timestamp: { $gte: startDate }
    });

    const statistics = {
      totalActions: actions.length,
      actionsByType: actions.reduce((acc, action) => {
        acc[action.actionType] = (acc[action.actionType] || 0) + 1;
        return acc;
      }, {}),
      actionsByDay: calculateActionsByDay(actions, days),
      mostActiveDevice: findMostActiveDevice(actions),
      recentActivity: actions.slice(0, 10).map(action => ({
        type: action.actionType,
        device: action.deviceID,
        timestamp: action.timestamp,
        details: action.details
      }))
    };

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Get action statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching action statistics'
    });
  }
});

// Helper functions
function calculateActionsByDay(actions, days) {
  const dailyCounts = {};
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    dailyCounts[dateString] = 0;
  }

  actions.forEach(action => {
    const dateString = action.timestamp.toISOString().split('T')[0];
    if (dailyCounts[dateString] !== undefined) {
      dailyCounts[dateString]++;
    }
  });

  return dailyCounts;
}

function findMostActiveDevice(actions) {
  const deviceCounts = actions.reduce((acc, action) => {
    acc[action.deviceID] = (acc[action.deviceID] || 0) + 1;
    return acc;
  }, {});

  const mostActive = Object.entries(deviceCounts).reduce((max, [device, count]) => {
    return count > max.count ? { device, count } : max;
  }, { device: null, count: 0 });

  return mostActive;
}

module.exports = router;