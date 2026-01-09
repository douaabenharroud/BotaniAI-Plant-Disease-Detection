const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema({
  ActionID: {
    type: String,
    required: true,
    unique: true
  },
  deviceID: {
    type: String,
    required: true
  },
  userID: {
    type: String,
    ref: 'User',
    required: true
  },
  actionType: {
    type: String,
    enum: ['watering', 'fertilizing', 'pruning', 'moving', 'monitoring', 'system'],
    required: true
  },
  details: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Static method to log action
actionSchema.statics.logAction = async function(userID, deviceID, actionType, details) {
  const actionID = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return await this.create({
    ActionID: actionID,
    userID,
    deviceID,
    actionType,
    details
  });
};

// Static method to get actions by user
actionSchema.statics.getActionsByUser = function(userID) {
  return this.find({ userID }).sort({ timestamp: -1 });
};

// Static method to get actions by device
actionSchema.statics.getActionsByDevice = function(deviceID) {
  return this.find({ deviceID }).sort({ timestamp: -1 });
};

module.exports = mongoose.model('Action', actionSchema);