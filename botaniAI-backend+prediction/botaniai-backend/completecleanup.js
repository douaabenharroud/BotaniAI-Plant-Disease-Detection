// COMPLETE_CLEANUP.js
const mongoose = require('mongoose');
require('dotenv').config();

async function completeCleanup() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/BotaniAI';
    
    console.log('🚨 STARTING COMPLETE DATABASE CLEANUP 🚨');
    console.log('=========================================\n');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // 1. List all collections
    const collections = await db.listCollections().toArray();
    console.log('📊 Found collections:');
    collections.forEach(col => console.log(`   - ${col.name}`));
    
    // 2. SPECIFICALLY FIX SensorReading collection
    console.log('\n🔧 Fixing SensorReading collection...');
    
    try {
      // Get ALL indexes
      const sensorCollection = db.collection('sensorreadings');
      const indexes = await sensorCollection.indexes();
      
      console.log('📋 Current indexes in sensorreadings:');
      indexes.forEach((index, i) => {
        console.log(`${i + 1}. ${JSON.stringify(index.key)} - Name: ${index.name}`);
      });
      
      // Remove ALL custom indexes
      for (const index of indexes) {
        // Keep only the default _id index
        if (index.name !== '_id_') {
          console.log(`🗑️  Dropping index: ${index.name}`);
          try {
            await sensorCollection.dropIndex(index.name);
            console.log(`✅ Dropped: ${index.name}`);
          } catch (dropErr) {
            console.log(`⚠️ Could not drop ${index.name}: ${dropErr.message}`);
          }
        }
      }
      
      // 3. DROP the entire collection
      console.log('\n🗑️  Dropping sensorreadings collection...');
      try {
        await sensorCollection.drop();
        console.log('✅ Successfully dropped sensorreadings collection');
      } catch (dropErr) {
        console.log('⚠️ Collection might not exist or already dropped');
      }
      
    } catch (sensorErr) {
      console.log('⚠️ SensorReading collection issue:', sensorErr.message);
    }
    
    // 4. Clean other test collections
    console.log('\n🧹 Cleaning other collections...');
    
    const collectionsToClean = [
      'users',
      'devices', 
      'plants',
      'deviceassignments',
      'predictions'
    ];
    
    for (const colName of collectionsToClean) {
      try {
        const collection = db.collection(colName);
        const count = await collection.countDocuments();
        console.log(`   ${colName}: ${count} documents`);
        
        // Delete test documents
        const deleteResult = await collection.deleteMany({
          $or: [
            { email: { $regex: /test/i } },
            { Email: { $regex: /test/i } },
            { deviceName: { $regex: /test/i } },
            { PlantName: { $regex: /test/i } },
            { userID: { $regex: /USER_/ } },
            { DeviceID: { $regex: /DEVICE_/ } },
            { PlantID: { $regex: /PLANT_/ } },
            { AssignmentID: { $regex: /ASSIGN_/ } }
          ]
        });
        
        if (deleteResult.deletedCount > 0) {
          console.log(`   ✅ Deleted ${deleteResult.deletedCount} test documents from ${colName}`);
        }
      } catch (err) {
        console.log(`   ⚠️ ${colName}: ${err.message}`);
      }
    }
    
    // 5. Recreate SensorReading collection with proper schema
    console.log('\n🔄 Recreating SensorReading collection...');
    
    // Get the model to recreate
    const SensorReading = require('./models/SensorReading');
    
    // Create a test document to initialize collection
    const testDoc = new SensorReading({
      SensorID: 'INIT_TEST',
      AssignmentID: 'INIT_TEST',
      DeviceID: 'INIT_TEST',
      plantID: 'INIT_TEST',
      userID: 'INIT_TEST',
      temperature: 25,
      humidity: 50,
      metadata: {
        source: 'manual',
        entryId: 'init_entry'
      }
    });
    
    await testDoc.save();
    console.log('✅ Created initialization document');
    
    // Delete the test document
    await SensorReading.deleteOne({ SensorID: 'INIT_TEST' });
    console.log('✅ Removed initialization document');
    
    // 6. Verify final state
    console.log('\n📊 Final verification:');
    
    const finalIndexes = await db.collection('sensorreadings').indexes();
    console.log('SensorReading indexes after cleanup:');
    finalIndexes.forEach(index => {
      console.log(`   - ${JSON.stringify(index.key)} (${index.name})`);
    });
    
    const docCount = await db.collection('sensorreadings').countDocuments();
    console.log(`Total documents in sensorreadings: ${docCount}`);
    
    console.log('\n✅ ✅ ✅ COMPLETE CLEANUP SUCCESSFUL ✅ ✅ ✅');
    console.log('The database is now ready for fresh testing!');
    
  } catch (error) {
    console.error('❌ COMPLETE CLEANUP FAILED:', error.message);
    console.error('Full error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup
completeCleanup();