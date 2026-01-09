const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  DeviceID: {
    type: String,
    required: true,
    unique: true
  },
  // ----- الحقول الأساسية -----
  deviceName: {  // ← غيّر name إلى deviceName
    type: String,
    default: 'My Device'
  },
  deviceType: {  // ← أضف هذا الحقل
    type: String,
    enum: ['sensor', 'controller', 'gateway', 'other'],
    default: 'sensor'
  },
  SensorID: {    // ← أضف هذا الحقل المهم!
    type: String,
    default: ''
  },
  userID: {      // ← أضف هذا الحقل المهم!
    type: String,
    required: true
  },
  
  // ----- حالة الجهاز -----
  Status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'offline'],
    default: 'active'
  },
  firmwareVersion: {
    type: String,
    default: '1.0.0'
  },
  location: String,
  
  // ----- الإمكانيات -----
  capabilities: {
    type: [String],
    default: ['temperature', 'humidity', 'soil_moisture', 'light']
  },
  
  // ----- بيانات المزامنة -----
  lastSyncTime: {
    type: Date,
    default: Date.now
  },
  lastData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  
  // ----- ThingSpeak integration -----
  thingSpeakChannelID: {
    type: String,
    default: null
  },
  thingSpeakWriteAPIKey: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Methods (تبقى كما هي)
deviceSchema.methods.updateFirmware = function(newVersion) {
  this.firmwareVersion = newVersion;
  return this.save();
};

deviceSchema.methods.getStatus = function() {
  return this.Status;
};

deviceSchema.methods.updateData = function(data) {
  this.lastData = data;
  this.lastSyncTime = new Date();
  return this.save();
};

deviceSchema.methods.isOnline = function() {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  return this.lastSyncTime > fifteenMinutesAgo && this.Status === 'active';
};

module.exports = mongoose.model('Device', deviceSchema);