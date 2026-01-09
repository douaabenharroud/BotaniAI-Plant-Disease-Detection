const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Plant = require('../models/Plant');
const Device = require('../models/Device');
const DeviceAssignment = require('../models/DeviceAssignment');
const SensorReading = require('../models/SensorReading');
const Analysis = require('../models/Analysis');
const Recommendations = require('../models/Recommendations');
const PlantImage = require('../models/PlantImage');
const Action = require('../models/Action');
const UserFeedback = require('../models/UserFeedback');

// ID generator
const { generateID } = require('../utils/idGenerator');

const createSampleData = async () => {
  try {
    console.log('🌱 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected');

    // Clear existing data (just in case)
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Plant.deleteMany({});
    await Device.deleteMany({});
    await DeviceAssignment.deleteMany({});
    await SensorReading.deleteMany({});
    await Analysis.deleteMany({});
    await Recommendations.deleteMany({});
    await PlantImage.deleteMany({});
    await Action.deleteMany({});
    await UserFeedback.deleteMany({});
    console.log('✅ Existing data cleared');

    // Create Users with proper unique usernames
    console.log('👥 Creating users...');
    const users = await User.create([
      {
        UserID: 'user_alice_001',
        Name: 'Alice Johnson',
        Username: 'alicej',
        Email: 'alice@email.com',
        HashedPassword: 'password123',
        CreatedAt: new Date('2024-01-15')
      },
      {
        UserID: 'user_bob_002',
        Name: 'Bob Smith',
        Username: 'bobsmith',
        Email: 'bob@email.com',
        HashedPassword: 'password123',
        CreatedAt: new Date('2024-02-20')
      },
      {
        UserID: 'user_demo_003',
        Name: 'Academic Demo User',
        Username: 'demo_user',
        Email: 'demo@email.com',
        HashedPassword: 'password123',
        CreatedAt: new Date()
      }
    ]);
    console.log(`✅ Created ${users.length} users`);

    // Create Plants
    console.log('🌿 Creating plants...');
    const plants = await Plant.create([
      {
        PlantID: 'plant_peace_lily_001',
        PlantName: 'Peace Lily',
        PlantType: 'Spathiphyllum',
        ideal_temperature_min: 18,
        ideal_temperature_max: 26,
        ideal_humidity_min: 40,
        ideal_humidity_max: 60,
        ideal_soil_moisture_min: 1000,
        ideal_soil_moisture_max: 3000,
        ideal_light_intensity_min: 200,
        ideal_light_intensity_max: 800,
        description: 'Popular indoor plant with white flowers'
      },
      {
        PlantID: 'plant_snake_002',
        PlantName: 'Snake Plant',
        PlantType: 'Sansevieria',
        ideal_temperature_min: 15,
        ideal_temperature_max: 28,
        ideal_humidity_min: 30,
        ideal_humidity_max: 70,
        ideal_soil_moisture_min: 800,
        ideal_soil_moisture_max: 2500,
        ideal_light_intensity_min: 100,
        ideal_light_intensity_max: 600,
        description: 'Low maintenance plant with upright leaves'
      },
      {
        PlantID: 'plant_spider_003',
        PlantName: 'Spider Plant',
        PlantType: 'Chlorophytum',
        ideal_temperature_min: 16,
        ideal_temperature_max: 24,
        ideal_humidity_min: 45,
        ideal_humidity_max: 65,
        ideal_soil_moisture_min: 1200,
        ideal_soil_moisture_max: 2800,
        ideal_light_intensity_min: 150,
        ideal_light_intensity_max: 700,
        description: 'Easy to grow with arching leaves'
      },
      {
        PlantID: 'plant_pothos_004',
        PlantName: 'Pothos',
        PlantType: 'Epipremnum',
        ideal_temperature_min: 17,
        ideal_temperature_max: 25,
        ideal_humidity_min: 35,
        ideal_humidity_max: 55,
        ideal_soil_moisture_min: 900,
        ideal_soil_moisture_max: 2700,
        ideal_light_intensity_min: 180,
        ideal_light_intensity_max: 750,
        description: 'Trailing vine plant, very adaptable'
      }
    ]);
    console.log(`✅ Created ${plants.length} plants`);

    // Create Devices
    console.log('📱 Creating devices...');
    const devices = await Device.create([
      {
        DeviceID: 'sensor_living_room_001',
        Status: 'active',
        firmwareVersion: '1.2.0',
        location: 'Living Room',
        lastSyncTime: new Date()
      },
      {
        DeviceID: 'sensor_bedroom_001',
        Status: 'active',
        firmwareVersion: '1.1.5',
        location: 'Bedroom',
        lastSyncTime: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      },
      {
        DeviceID: 'sensor_office_001',
        Status: 'active',
        firmwareVersion: '1.2.0',
        location: 'Home Office',
        lastSyncTime: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      },
      {
        DeviceID: 'sensor_kitchen_001',
        Status: 'maintenance',
        firmwareVersion: '1.0.8',
        location: 'Kitchen',
        lastSyncTime: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      }
    ]);
    console.log(`✅ Created ${devices.length} devices`);

    // Create Device Assignments
    console.log('🔗 Creating device assignments...');
    const assignments = await DeviceAssignment.create([
      {
        AssignmentID: 'assign_living_room_001',
        SensorID: 'sensor_living_room_001',
        plantID: plants[0].PlantID, // Peace Lily
        userID: users[0].UserID, // Alice
        startDate: new Date('2024-01-20'),
        status: 'active'
      },
      {
        AssignmentID: 'assign_bedroom_001',
        SensorID: 'sensor_bedroom_001',
        plantID: plants[1].PlantID, // Snake Plant
        userID: users[0].UserID, // Alice
        startDate: new Date('2024-02-01'),
        status: 'active'
      },
      {
        AssignmentID: 'assign_office_001',
        SensorID: 'sensor_office_001',
        plantID: plants[2].PlantID, // Spider Plant
        userID: users[1].UserID, // Bob
        startDate: new Date('2024-02-15'),
        status: 'active'
      },
      {
        AssignmentID: 'assign_kitchen_001',
        SensorID: 'sensor_kitchen_001',
        plantID: plants[3].PlantID, // Pothos
        userID: users[2].UserID, // Demo User
        startDate: new Date('2024-03-01'),
        status: 'active'
      }
    ]);
    console.log(`✅ Created ${assignments.length} device assignments`);

    // Create Sensor Readings (simplified - fewer records for testing)
    console.log('📊 Creating sensor readings...');
    const sensorReadings = [];
    const now = new Date();
    
    // Create 24 readings (1 day) instead of 168 to make it faster
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000); // Every hour for 1 day
      
      devices.forEach(device => {
        const baseTemp = device.location === 'Living Room' ? 22 : 
                        device.location === 'Bedroom' ? 21 : 
                        device.location === 'Home Office' ? 23 : 24;
        
        const baseHumidity = device.location === 'Living Room' ? 50 : 
                           device.location === 'Bedroom' ? 45 : 
                           device.location === 'Home Office' ? 55 : 60;
        
        // Daily temperature cycle
        const hour = timestamp.getHours();
        const tempVariation = Math.sin(hour * Math.PI / 12) * 3;
        const humidityVariation = Math.cos(hour * Math.PI / 12) * 10;
        
        const reading = {
          ReadingID: `reading_${device.DeviceID}_${i}`,
          deviceID: device.DeviceID,
          timestamp: timestamp,
          temperature: parseFloat((baseTemp + tempVariation + (Math.random() - 0.5) * 2).toFixed(1)),
          humidity: parseFloat((baseHumidity + humidityVariation + (Math.random() - 0.5) * 5).toFixed(1)),
          soilMoisture: Math.floor(1800 + Math.sin(i * 0.5) * 600 + (Math.random() - 0.5) * 200),
          lightIntensity: Math.floor(
            hour >= 6 && hour <= 18 ? // Daytime
            400 + Math.sin((hour - 6) * Math.PI / 12) * 300 + (Math.random() - 0.5) * 100 :
            50 + Math.random() * 50 // Nighttime
          )
        };
        
        sensorReadings.push(reading);
      });
    }

    await SensorReading.insertMany(sensorReadings);
    console.log(`✅ Created ${sensorReadings.length} sensor readings`);

    // Create Analyses and Recommendations
    console.log('🤖 Creating analyses and recommendations...');
    const analyses = [];
    const recommendations = [];
    
    // Create analyses for recent readings (last 5 per device)
    for (const device of devices) {
      const deviceReadings = await SensorReading.find({ deviceID: device.DeviceID })
        .sort({ timestamp: -1 })
        .limit(5);

      for (const reading of deviceReadings) {
        const healthScore = Math.floor(3 + Math.random() * 2); // 3-5
        const anomalyDetected = Math.random() > 0.8;
        
        const analysis = new Analysis({
          AnalysisID: `analysis_${device.DeviceID}_${reading.timestamp.getTime()}`,
          deviceID: device.DeviceID,
          TimeStamp: reading.timestamp,
          HealthScore: healthScore,
          anomalyDetected: anomalyDetected,
          predictedIssues: anomalyDetected ? ['Check environmental conditions'] : [],
          confidenceScore: parseFloat((0.7 + Math.random() * 0.25).toFixed(2))
        });

        await analysis.save();
        analyses.push(analysis);

        // Create recommendations for analyses with lower health scores or anomalies
        if (healthScore < 4 || anomalyDetected) {
          const recommendationTexts = [
            'Consider increasing watering frequency - soil moisture is low',
            'Move plant to brighter location - light levels are suboptimal',
            'Temperature is outside ideal range - adjust room temperature',
            'Humidity levels are low - consider using a humidifier',
            'Plant shows signs of stress - review care conditions'
          ];

          const recommendation = new Recommendations({
            recommendationID: `rec_${analysis.AnalysisID}`,
            analysisID: analysis.AnalysisID,
            text: recommendationTexts[Math.floor(Math.random() * recommendationTexts.length)],
            priority: healthScore <= 2 ? 1 : 2,
            category: ['watering', 'lighting', 'temperature', 'humidity', 'general'][Math.floor(Math.random() * 5)],
            notified: Math.random() > 0.5,
            type: anomalyDetected ? 'immediate' : 'informational'
          });

          await recommendation.save();
          recommendations.push(recommendation);
        }
      }
    }
    console.log(`✅ Created ${analyses.length} analyses and ${recommendations.length} recommendations`);

    // Create Plant Images
    console.log('📸 Creating plant images...');
    const plantImages = await PlantImage.create([
      {
        ImageID: 'img_peace_lily_001',
        PlantID: plants[0].PlantID,
        ImageURL: 'https://example.com/images/peace_lily_1.jpg',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        AnalysisScore: 4
      },
      {
        ImageID: 'img_snake_plant_001',
        PlantID: plants[1].PlantID,
        ImageURL: 'https://example.com/images/snake_plant_1.jpg',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        AnalysisScore: 5
      }
    ]);
    console.log(`✅ Created ${plantImages.length} plant images`);

    // Create Actions
    console.log('📝 Creating actions...');
    const actions = await Action.create([
      {
        ActionID: 'act_watering_001',
        deviceID: 'sensor_living_room_001',
        userID: users[0].UserID,
        actionType: 'watering',
        details: 'Watered Peace Lily with 200ml',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        ActionID: 'act_monitoring_001',
        deviceID: 'sensor_living_room_001',
        userID: users[0].UserID,
        actionType: 'monitoring',
        details: 'Checked plant health status',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000)
      }
    ]);
    console.log(`✅ Created ${actions.length} actions`);

    // Create User Feedback
    console.log('💬 Creating user feedback...');
    if (recommendations.length > 0) {
      const feedback = await UserFeedback.create([
        {
          FeedbackID: 'fb_001',
          UserID: users[0].UserID,
          RecommendationID: recommendations[0].recommendationID,
          Response: 'This recommendation was very helpful! My plant looks much better now.',
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        }
      ]);
      console.log(`✅ Created ${feedback.length} user feedback entries`);
    }

    console.log('\n🎉 Sample data creation completed!');
    console.log('\n📊 Data Summary:');
    console.log(`   👥 Users: ${users.length}`);
    console.log(`   🌿 Plants: ${plants.length}`);
    console.log(`   📱 Devices: ${devices.length}`);
    console.log(`   🔗 Assignments: ${assignments.length}`);
    console.log(`   📊 Sensor Readings: ${sensorReadings.length}`);
    console.log(`   🤖 Analyses: ${analyses.length}`);
    console.log(`   💡 Recommendations: ${recommendations.length}`);
    console.log(`   📸 Plant Images: ${plantImages.length}`);
    console.log(`   📝 Actions: ${actions.length}`);
    console.log(`   💬 Feedback: ${recommendations.length > 0 ? 1 : 0}`);

    console.log('\n🔑 Demo Login Credentials:');
    console.log('   Email: demo@email.com');
    console.log('   Password: password123');
    console.log('   Email: alice@email.com');
    console.log('   Password: password123');

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    console.error('Error details:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔗 Database connection closed');
    process.exit(0);
  }
};

// Run the script
createSampleData();