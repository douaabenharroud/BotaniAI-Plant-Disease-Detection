// services/scheduler.js
const cron = require('node-cron');
const ThingSpeakService = require('./thingspeakService');
const SensorData = require('../models/SensorReading');
const Device = require('../models/Device');
const DeviceAssignment = require('../models/DeviceAssignment');

class Scheduler {
  constructor() {
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    
    console.log('⏰ Starting ThingSpeak sync scheduler...');
    
    // Schedule to run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.syncThingSpeakData();
    });
    
    this.isRunning = true;
  }

  async syncThingSpeakData() {
    try {
      console.log('🔄 Syncing ThingSpeak data...');
      
      // Get all devices with ThingSpeak credentials
      const devices = await Device.find({
        thingSpeakChannelID: { $ne: null },
        thingSpeakWriteAPIKey: { $ne: null },
        Status: 'active'
      });

      let syncedCount = 0;
      
      for (const device of devices) {
        try {
          // Get latest data from ThingSpeak
          const data = await ThingSpeakService.getLatestData(
            device.thingSpeakChannelID,
            device.thingSpeakWriteAPIKey
          );

          // Find active assignment
          const assignment = await DeviceAssignment.findOne({
            DeviceID: device.DeviceID,
            status: 'active'
          });

          if (assignment && !data.isMock) {
            // Save to database
            const sensorReading = new SensorData({
              SensorID: device.SensorID || device.DeviceID,
              DeviceID: device.DeviceID,
              AssignmentID: assignment.AssignmentID,
              plantID: assignment.plantID,
              userID: assignment.userID,
              temperature: data.temperature,
              humidity: data.humidity,
              soilMoisture: data.soilMoisture,
              lightIntensity: data.lightIntensity,
              timestamp: data.timestamp
            });

            await sensorReading.save();
            
            // Update device last sync time
            device.lastSyncTime = new Date();
            device.lastData = data;
            await device.save();
            
            syncedCount++;
            console.log(`✅ Synced data for device ${device.DeviceID}`);
          }
        } catch (deviceError) {
          console.error(`❌ Error syncing device ${device.DeviceID}:`, deviceError.message);
        }
      }
      
      console.log(`✅ ThingSpeak sync completed. Synced ${syncedCount} devices.`);
    } catch (error) {
      console.error('❌ Scheduler error:', error.message);
    }
  }
}

module.exports = new Scheduler();