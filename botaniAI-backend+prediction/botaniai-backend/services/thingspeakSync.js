// services/thingspeakSync.js
const ThingSpeakService = require('./thingspeakService');
const SensorData = require('../models/SensorReading');
const Device = require('../models/Device');
const DeviceAssignment = require('../models/DeviceAssignment');
const Plant = require('../models/Plant');

class ThingSpeakSync {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.lastSyncTimestamps = new Map(); // Track last sync per channel
  }

  // Start automatic sync
  start() {
    if (this.isRunning) {
      console.log('⚠️ ThingSpeak sync is already running');
      return;
    }
    
    console.log('🚀 Starting ThingSpeak Auto-Sync (30 seconds interval)...');
    
    // Run immediately on start
    this.syncAllChannels();
    
    // Then run every 30 seconds
    this.intervalId = setInterval(() => {
      this.syncAllChannels();
    }, 30000); // 30 seconds
    
    this.isRunning = true;
  }

  // Stop automatic sync
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 ThingSpeak Auto-Sync stopped');
  }

  // Sync data from all configured channels
  async syncAllChannels() {
    try {
      console.log('🔄 Syncing ThingSpeak channels...');
      
      // Sync from Devices (if devices have ThingSpeak credentials)
      await this.syncDeviceChannels();
      
      console.log('✅ ThingSpeak sync cycle completed');
    } catch (error) {
      console.error('❌ ThingSpeak sync error:', error.message);
    }
  }

  // Sync from Device ThingSpeak channels
  async syncDeviceChannels() {
    try {
      // Get devices with valid credentials
      const devices = await Device.find({
        Status: 'active',
        thingSpeakChannelID: { 
          $exists: true, 
          $ne: null, 
          $ne: '' 
        },
        thingSpeakWriteAPIKey: { 
          $exists: true, 
          $ne: null, 
          $ne: '' 
        }
      });

      console.log(`📱 Found ${devices.length} devices with ThingSpeak credentials`);

      if (devices.length === 0) {
        console.log('⚠️ No devices found with valid ThingSpeak credentials');
        return;
      }

      // Validate each device's credentials
      const validDevices = devices.filter(device => {
        const channelID = String(device.thingSpeakChannelID).trim();
        const apiKey = String(device.thingSpeakWriteAPIKey).trim();
        
        if (!channelID || !apiKey) {
          console.log(`⚠️ Device ${device.DeviceID} has invalid credentials`);
          return false;
        }
        
        return true;
      });

      console.log(`📱 ${validDevices.length} devices have valid credentials`);

      for (const device of validDevices) {
        try {
          const channelID = String(device.thingSpeakChannelID).trim();
          const apiKey = String(device.thingSpeakWriteAPIKey).trim();
          
          console.log(`\n🔧 Syncing device: ${device.DeviceID} (Channel: ${channelID})`);
          
          await this.syncSingleChannel(
            channelID,
            apiKey,
            {
              deviceID: device.DeviceID,
              sensorID: device.SensorID || device.DeviceID,
              userID: device.userID || 'unknown'
            }
          );
        } catch (deviceError) {
          console.error(`❌ Error syncing device ${device.DeviceID}:`, deviceError.message);
        }
      }
    } catch (error) {
      console.error('❌ Error syncing device channels:', error.message);
    }
  }

  // Sync a single ThingSpeak channel
  async syncSingleChannel(channelID, apiKey, context = {}) {
    try {
      const cleanChannelID = String(channelID).trim();
      const cleanApiKey = String(apiKey).trim();
      
      const channelKey = `${cleanChannelID}_${cleanApiKey}`;
      const lastSync = this.lastSyncTimestamps.get(channelKey) || 0;
      const now = Date.now();
      
      // Skip if synced very recently (10 seconds)
      if (now - lastSync < 10000) {
        console.log(`⏭️ Skipping channel ${cleanChannelID}, synced recently`);
        return null;
      }

      console.log(`📡 Syncing ThingSpeak Channel: ${cleanChannelID}`);

      // Get latest data
      let data;
      try {
        data = await ThingSpeakService.getLatestData(cleanChannelID, cleanApiKey);
      } catch (error) {
        console.error(`❌ Failed to fetch from channel ${cleanChannelID}:`, error.message);
        return null;
      }
      
      if (!data) {
        console.log(`⚠️ No data received from channel ${cleanChannelID}`);
        return null;
      }

      // Try to find assignment for this device
      let assignmentID = null;
      let plantID = null;
      let userID = context.userID || 'unknown';
      
      if (context.deviceID) {
        const assignment = await DeviceAssignment.findOne({
          DeviceID: context.deviceID,
          status: 'active'
        });
        
        if (assignment) {
          assignmentID = assignment.AssignmentID;
          plantID = assignment.plantID;
          userID = assignment.userID || userID;
        } else {
          // Try to find any plant for this user
          const plant = await Plant.findOne({ userID: userID });
          if (plant) {
            plantID = plant.PlantID;
            // Create a temporary assignment
            const newAssignment = new DeviceAssignment({
              AssignmentID: `temp_${context.deviceID}_${Date.now()}`,
              DeviceID: context.deviceID,
              plantID: plantID,
              userID: userID,
              status: 'active',
              startDate: new Date()
            });
            await newAssignment.save();
            assignmentID = newAssignment.AssignmentID;
            console.log(`   Created temporary assignment: ${assignmentID}`);
          }
        }
      }

      // Check if we already have this entry (by entryId or timestamp)
      let existingEntry = null;
      
      if (data.entryId) {
        existingEntry = await SensorData.findOne({
          'metadata.entryId': data.entryId,
          'metadata.channelId': cleanChannelID
        });
      }
      
      if (!existingEntry && data.timestamp) {
        // Check for entries with similar timestamp (±5 minutes)
        const fiveMinutes = 5 * 60 * 1000;
        existingEntry = await SensorData.findOne({
          'metadata.channelId': cleanChannelID,
          timestamp: {
            $gte: new Date(data.timestamp.getTime() - fiveMinutes),
            $lte: new Date(data.timestamp.getTime() + fiveMinutes)
          }
        });
      }

      if (existingEntry) {
        console.log(`⏭️ Data already exists for channel ${cleanChannelID}, entry: ${data.entryId || 'no entryId'}`);
        return existingEntry;
      }

      // Prepare sensor reading data
      const sensorReadingData = {
        SensorID: context.sensorID || `channel_${cleanChannelID}`,
        DeviceID: context.deviceID || `device_${cleanChannelID}`,
        AssignmentID: assignmentID,
        plantID: plantID,
        userID: userID,
        temperature: data.temperature,
        humidity: data.humidity,
        soilMoisture: data.soilMoisture,
        lightIntensity: data.lightIntensity,
        timestamp: data.timestamp,
        metadata: {
          source: 'thingspeak',
          channelId: cleanChannelID,
          entryId: data.entryId || null,
          syncedAt: new Date()
        }
      };

      // Save to database
      const sensorReading = new SensorData(sensorReadingData);
      await sensorReading.save();

      console.log(`✅ Saved data from ThingSpeak Channel ${cleanChannelID}:`, {
        entryId: data.entryId || 'no entryId',
        temperature: data.temperature,
        humidity: data.humidity,
        plantID: plantID || 'no plant'
      });

      // Update last sync timestamp
      this.lastSyncTimestamps.set(channelKey, now);

      return sensorReading;

    } catch (error) {
      console.error(`❌ Error syncing channel ${channelID}:`, error.message);
      throw error;
    }
  }

  // Manual sync for a specific channel
  async manualSync(channelID, apiKey, context = {}) {
    try {
      console.log(`🔧 Manual sync requested for channel ${channelID}`);
      
      const result = await this.syncSingleChannel(channelID, apiKey, context);
      
      if (result) {
        return {
          success: true,
          message: 'Data synced successfully',
          data: result
        };
      } else {
        return {
          success: false,
          message: 'No new data to sync or channel not accessible'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Sync error: ${error.message}`
      };
    }
  }

  // Get sync status
  getSyncStatus() {
    const status = {
      isRunning: this.isRunning,
      channelsSynced: this.lastSyncTimestamps.size,
      lastSyncTimes: {}
    };

    for (const [channelKey, timestamp] of this.lastSyncTimestamps) {
      const [channelID, apiKey] = channelKey.split('_');
      const maskedApiKey = apiKey ? '***' + apiKey.slice(-4) : 'unknown';
      status.lastSyncTimes[channelID] = {
        lastSync: new Date(timestamp).toISOString(),
        secondsAgo: Math.floor((Date.now() - timestamp) / 1000),
        apiKey: maskedApiKey
      };
    }

    return status;
  }
}

module.exports = new ThingSpeakSync();