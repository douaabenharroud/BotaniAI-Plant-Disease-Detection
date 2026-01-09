// scripts/debugDeviceAssignments.js
const mongoose = require('mongoose');
require('dotenv').config();

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/BotaniAI');
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    return false;
  }
}

async function debugChannelIssues() {
  try {
    const Device = require('../models/Device');
    const DeviceAssignment = require('../models/DeviceAssignment');
    const Plant = require('../models/Plant');
    const SensorReading = require('../models/SensorReading');
    
    console.log('🔍 Debugging ThingSpeak Channel Issues...\n');
    
    // Find devices with ThingSpeak credentials
    const devices = await Device.find({
      thingSpeakChannelID: { $ne: null, $ne: '' }
    });
    
    console.log(`📱 Devices with ThingSpeak: ${devices.length}`);
    
    for (const device of devices) {
      console.log(`\n=== Device: ${device.deviceName} ===`);
      console.log(`   DeviceID: ${device.DeviceID}`);
      console.log(`   Channel: ${device.thingSpeakChannelID}`);
      console.log(`   UserID: ${device.userID}`);
      console.log(`   Status: ${device.Status}`);
      
      // Check assignments
      const assignments = await DeviceAssignment.find({
        DeviceID: device.DeviceID
      });
      
      console.log(`   Assignments: ${assignments.length}`);
      
      for (const assignment of assignments) {
        console.log(`   • AssignmentID: ${assignment.AssignmentID}`);
        console.log(`     PlantID: ${assignment.plantID}`);
        console.log(`     Status: ${assignment.status}`);
        
        // Check if plant exists
        const plant = await Plant.findOne({ PlantID: assignment.plantID });
        if (plant) {
          console.log(`     Plant Name: ${plant.PlantName} ✅`);
        } else {
          console.log(`     Plant: NOT FOUND ❌`);
        }
      }
      
      // Check existing sensor readings for this device
      const readings = await SensorReading.find({
        DeviceID: device.DeviceID,
        'metadata.source': 'thingspeak'
      }).sort({ timestamp: -1 }).limit(3);
      
      console.log(`   ThingSpeak Readings: ${readings.length}`);
      readings.forEach((reading, i) => {
        console.log(`     ${i + 1}. Entry: ${reading.metadata?.entryId}, Plant: ${reading.plantID || 'MISSING'}`);
      });
    }
    
    // Check for the specific failing channel
    console.log('\n🔴 PROBLEM ANALYSIS:');
    console.log('=' .repeat(50));
    
    const failingDevice = await Device.findOne({
      thingSpeakChannelID: '3125005'
    });
    
    if (failingDevice) {
      console.log(`Device for channel 3125005: ${failingDevice.deviceName}`);
      
      const assignment = await DeviceAssignment.findOne({
        DeviceID: failingDevice.DeviceID,
        status: 'active'
      });
      
      if (!assignment) {
        console.log('❌ NO ACTIVE ASSIGNMENT FOUND!');
        console.log('This is why plantID is required but missing.');
      } else {
        console.log(`✅ Assignment found: ${assignment.AssignmentID}`);
        console.log(`   PlantID: ${assignment.plantID}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
  }
}

async function fixMissingAssignments() {
  try {
    const Device = require('../models/Device');
    const DeviceAssignment = require('../models/DeviceAssignment');
    const Plant = require('../models/Plant');
    
    console.log('\n🔧 Fixing missing device assignments...');
    
    // Find all devices with ThingSpeak but no active assignment
    const devices = await Device.find({
      thingSpeakChannelID: { $ne: null, $ne: '' }
    });
    
    let fixedCount = 0;
    
    for (const device of devices) {
      // Check for active assignment
      const activeAssignment = await DeviceAssignment.findOne({
        DeviceID: device.DeviceID,
        status: 'active'
      });
      
      if (!activeAssignment) {
        console.log(`\n⚠️ Device ${device.deviceName} has no active assignment`);
        
        // Find a plant for this user
        const plant = await Plant.findOne({ 
          userID: device.userID 
        });
        
        if (plant) {
          // Create assignment
          const assignmentID = `FIX_ASSIGN_${device.DeviceID}_${plant.PlantID}`;
          
          await DeviceAssignment.create({
            AssignmentID: assignmentID,
            DeviceID: device.DeviceID,
            plantID: plant.PlantID,
            userID: device.userID,
            status: 'active',
            startDate: new Date()
          });
          
          console.log(`✅ Created assignment: ${device.deviceName} → ${plant.PlantName}`);
          fixedCount++;
        } else {
          console.log(`❌ No plant found for user ${device.userID}`);
          
          // Create a default plant if none exists
          const defaultPlant = await Plant.create({
            PlantID: `DEFAULT_PLANT_${device.userID}`,
            PlantName: 'Default Plant',
            PlantType: 'General',
            userID: device.userID,
            ideal_temperature_min: 18,
            ideal_temperature_max: 28,
            ideal_humidity_min: 40,
            ideal_humidity_max: 70,
            ideal_soil_moisture_min: 1000,
            ideal_soil_moisture_max: 2500,
            ideal_light_intensity_min: 200,
            ideal_light_intensity_max: 1000,
            description: 'Auto-created default plant'
          });
          
          // Create assignment with default plant
          const assignmentID = `FIX_ASSIGN_${device.DeviceID}_${defaultPlant.PlantID}`;
          
          await DeviceAssignment.create({
            AssignmentID: assignmentID,
            DeviceID: device.DeviceID,
            plantID: defaultPlant.PlantID,
            userID: device.userID,
            status: 'active',
            startDate: new Date()
          });
          
          console.log(`✅ Created default plant and assignment`);
          fixedCount++;
        }
      }
    }
    
    console.log(`\n📊 Fixed ${fixedCount} device assignments`);
    return fixedCount;
    
  } catch (error) {
    console.error('❌ Error fixing assignments:', error.message);
    return 0;
  }
}

async function testThingSpeakSyncForChannel(channelID) {
  try {
    console.log(`\n🧪 Testing ThingSpeak sync for channel ${channelID}...`);
    
    const ThingSpeakSync = require('../services/thingspeakSync');
    const ThingSpeakService = require('../services/thingspeakService');
    const Device = require('../models/Device');
    
    // Find device for this channel
    const device = await Device.findOne({ thingSpeakChannelID: channelID });
    
    if (!device) {
      console.log(`❌ No device found for channel ${channelID}`);
      return false;
    }
    
    console.log(`   Device: ${device.deviceName}`);
    console.log(`   API Key: ${device.thingSpeakWriteAPIKey ? 'Set' : 'Missing'}`);
    
    // Test ThingSpeak connection
    const data = await ThingSpeakService.getLatestData(
      channelID,
      device.thingSpeakWriteAPIKey
    );
    
    if (!data) {
      console.log(`❌ Could not fetch data from channel ${channelID}`);
      return false;
    }
    
    console.log(`✅ Data available: Entry ${data.entryId}, Temp ${data.temperature}°C`);
    
    // Try manual sync
    const result = await ThingSpeakSync.manualSync(
      channelID,
      device.thingSpeakWriteAPIKey,
      {
        deviceID: device.DeviceID,
        sensorID: device.SensorID,
        userID: device.userID
      }
    );
    
    if (result && result.success) {
      console.log(`✅ Sync successful! ${result.message}`);
      return true;
    } else {
      console.log(`❌ Sync failed: ${result?.message || 'Unknown error'}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Test error for channel ${channelID}:`, error.message);
    return false;
  }
}

async function runDebugAndFix() {
  console.log('🔧 Debugging and Fixing ThingSpeak Sync Issues\n');
  
  try {
    // Connect to database
    const connected = await connectDB();
    if (!connected) return;
    
    // Step 1: Debug current state
    await debugChannelIssues();
    
    // Step 2: Fix missing assignments
    const fixedCount = await fixMissingAssignments();
    
    // Step 3: Test both channels
    console.log('\n🚀 Testing ThingSpeak channels after fix...');
    
    const channels = ['3125005', '3123941'];
    const results = {};
    
    for (const channel of channels) {
      results[channel] = await testThingSpeakSyncForChannel(channel);
    }
    
    console.log('\n🎯 TEST RESULTS:');
    console.log('=' .repeat(50));
    
    Object.entries(results).forEach(([channel, success]) => {
      console.log(`Channel ${channel}: ${success ? '✅ WORKING' : '❌ FAILED'}`);
    });
    
    if (Object.values(results).every(r => r)) {
      console.log('\n🎉 ALL CHANNELS ARE WORKING!');
    } else {
      console.log('\n🔴 SOME CHANNELS STILL HAVE ISSUES');
      console.log('Check the logs above for specific errors.');
    }
    
  } catch (error) {
    console.error('❌ Debug/fix failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run debug
if (require.main === module) {
  runDebugAndFix();
}