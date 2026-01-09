const SensorData = require('../models/SensorData');
const ThingSpeakService = require('./thingspeakService');

async function fetchAndSave() {
  try {
    // Fetch latest data from ThingSpeak
    const latest = await ThingSpeakService.getLatestData();
    
    // If no data returned, skip
    if (!latest) {
      console.log('⚠️ No data received from ThingSpeak');
      return;
    }

    // Check if already in DB
    const exists = await SensorData.findOne({ timestamp: latest.timestamp });
    if (exists) return; // skip duplicates

    // Save to MongoDB
    const sensor = new SensorData(latest);
    await sensor.save();

    console.log('✅ Saved ThingSpeak data:', latest);
  } catch (err) {
    console.error('❌ Error saving ThingSpeak data:', err.message);
  }
}

// Fetch every 1 minute
setInterval(fetchAndSave, 60 * 1000);

module.exports = fetchAndSave;