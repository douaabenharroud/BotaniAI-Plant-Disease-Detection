const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  
  // SensorID = DeviceID
  SensorID: {
    type: String,
    required: true
  },

  // AssignmentID = رابط المستشعر بالنبات
  AssignmentID: {
    type: String,
    required: true
  },

  // DeviceID = مرتبط بالجهاز
  DeviceID: {
    type: String,
    required: true  // <-- أضفنا DeviceID هنا
  },

  // PlantID
  plantID: {
    type: String,
    required: true
  },

  // UserID
  userID: {
    type: String,
    required: true
  },

  temperature: Number,
  humidity: Number,
  soilMoisture: Number,
  lightIntensity: Number,
 metadata: {
    source: {
      type: String,
      enum: ['direct', 'thingspeak', 'manual'],
      default: 'direct'
    },
    channelId: String,
    entryId: String,
    syncedAt: Date
  }
}, { 
  timestamps: true,
  // Create indexes for faster queries
  indexes: [
    { userID: 1, timestamp: -1 },
    { plantID: 1, timestamp: -1 },
    { DeviceID: 1, timestamp: -1 },
    { 'metadata.channelId': 1, 'metadata.entryId': 1 },
    { 'metadata.source': 1 }
  ]
});

module.exports = mongoose.model('SensorReading', sensorReadingSchema);