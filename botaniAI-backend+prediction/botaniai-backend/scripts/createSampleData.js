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

    // Clear existing data
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

    // Create Users
    console.log('👥 Creating users...');
    const users = await User.create([
      {
        UserID: generateID('user'),
        Name: 'Alice Johnson',
        Username: 'alicej',
        Email: 'alice@email.com',
        HashedPassword: 'password123',
        CreatedAt: new Date('2024-01-15')
      },
      {
        UserID: generateID('user'),
        Name: 'Bob Smith',
        Username: 'bobsmith',
        Email: 'bob@email.com',
        HashedPassword: 'password123',
        CreatedAt: new Date('2024-02-20')
      },
      {
        UserID: generateID('user'),
        Name: 'Academic Demo User',
        Username: 'demo',
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
        PlantID: generateID('plant'),
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
        PlantID: generateID('plant'),
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
        PlantID: generateID('plant'),
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
        PlantID: generateID('plant'),
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
        AssignmentID: generateID('assign'),
        SensorID: 'sensor_living_room_001',
        plantID: plants[0].PlantID, // Peace Lily
        userID: users[0].UserID, // Alice
        startDate: new Date('2024-01-20'),
        status: 'active'
      },
      {
        AssignmentID: generateID('assign'),
        SensorID: 'sensor_bedroom_001',
        plantID: plants[1].PlantID, // Snake Plant
        userID: users[0].UserID, // Alice
        startDate: new Date('2024-02-01'),
        status: 'active'
      },
      {
        AssignmentID: generateID('assign'),
        SensorID: 'sensor_office_001',
        plantID: plants[2].PlantID, // Spider Plant
        userID: users[1].UserID, // Bob
        startDate: new Date('2024-02-15'),
        status: 'active'
      },
      {
        AssignmentID: generateID('assign'),
        SensorID: 'sensor_kitchen_001',
        plantID: plants[3].PlantID, // Pothos
        userID: users[2].UserID, // Demo User
        startDate: new Date('2024-03-01'),
        status: 'active'
      }
    ]);
    console.log(`✅ Created ${assignments.length} device assignments`);

    // Create Sensor Readings (last 7 days with realistic patterns)
    console.log('📊 Creating sensor readings...');
    const sensorReadings = [];
    const now = new Date();
    
    for (let i = 0; i < 168; i++) { // 7 days * 24 hours = 168 readings
      const timestamp = new Date(now.getTime() - (167 - i) * 60 * 60 * 1000); // Every hour for 7 days
      
      // Create realistic patterns for each device
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
        
        // Weekly pattern (weekends different)
        const dayOfWeek = timestamp.getDay();
        const weekendEffect = (dayOfWeek === 0 || dayOfWeek === 6) ? 1 : 0;
        
        const reading = {
          ReadingID: generateID('reading'),
          deviceID: device.DeviceID,
          timestamp: timestamp,
          temperature: parseFloat((baseTemp + tempVariation + (Math.random() - 0.5) * 2 + weekendEffect).toFixed(1)),
          humidity: parseFloat((baseHumidity + humidityVariation + (Math.random() - 0.5) * 5).toFixed(1)),
          soilMoisture: Math.floor(1800 + Math.sin(i * 0.2) * 600 + (Math.random() - 0.5) * 200),
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
    
    // Create analyses for recent readings
    const recentReadings = await SensorReading.find()
      .sort({ timestamp: -1 })
      .limit(20);

    for (const reading of recentReadings) {
      const analysis = new Analysis({
        AnalysisID: generateID('analysis'),
        deviceID: reading.deviceID,
        TimeStamp: reading.timestamp,
        HealthScore: Math.floor(3 + Math.random() * 2), // 3-5
        anomalyDetected: Math.random() > 0.8, // 20% chance of anomaly
        predictedIssues: Math.random() > 0.7 ? ['Check soil moisture', 'Monitor temperature'] : [],
        confidenceScore: parseFloat((0.7 + Math.random() * 0.25).toFixed(2)) // 0.7-0.95
      });

      await analysis.save();
      analyses.push(analysis);

      // Create recommendations for analyses with lower health scores or anomalies
      if (analysis.HealthScore < 4 || analysis.anomalyDetected) {
        const recommendationTexts = [
          'Consider increasing watering frequency - soil moisture is low',
          'Move plant to brighter location - light levels are suboptimal',
          'Temperature is outside ideal range - adjust room temperature',
          'Humidity levels are low - consider using a humidifier',
          'Plant shows signs of stress - review care conditions'
        ];

        const recommendation = new Recommendations({
          recommendationID: generateID('rec'),
          analysisID: analysis.AnalysisID,
          text: recommendationTexts[Math.floor(Math.random() * recommendationTexts.length)],
          priority: analysis.HealthScore <= 2 ? 1 : 2,
          category: ['watering', 'lighting', 'temperature', 'humidity', 'general'][Math.floor(Math.random() * 5)],
          notified: Math.random() > 0.5,
          type: analysis.anomalyDetected ? 'immediate' : 'informational'
        });

        await recommendation.save();
        recommendations.push(recommendation);
      }
    }
    console.log(`✅ Created ${analyses.length} analyses and ${recommendations.length} recommendations`);

    // Create Plant Images
    console.log('📸 Creating plant images...');
    const plantImages = await PlantImage.create([
      {
        ImageID: generateID('img'),
        PlantID: plants[0].PlantID,
        ImageURL: 'https://example.com/images/peace_lily_1.jpg',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        AnalysisScore: 4
      },
      {
        ImageID: generateID('img'),
        PlantID: plants[0].PlantID,
        ImageURL: 'https://example.com/images/peace_lily_2.jpg',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        AnalysisScore: 3
      },
      {
        ImageID: generateID('img'),
        PlantID: plants[1].PlantID,
        ImageURL: 'https://example.com/images/snake_plant_1.jpg',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        AnalysisScore: 5
      },
      {
        ImageID: generateID('img'),
        PlantID: plants[2].PlantID,
        ImageURL: 'https://example.com/images/spider_plant_1.jpg',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        AnalysisScore: 4
      }
    ]);
    console.log(`✅ Created ${plantImages.length} plant images`);

    // Create Actions
    console.log('📝 Creating actions...');
    const actions = await Action.create([
      {
        ActionID: generateID('act'),
        deviceID: 'sensor_living_room_001',
        userID: users[0].UserID,
        actionType: 'watering',
        details: 'Watered Peace Lily with 200ml',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        ActionID: generateID('act'),
        deviceID: 'sensor_living_room_001',
        userID: users[0].UserID,
        actionType: 'monitoring',
        details: 'Checked plant health status',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000)
      },
      {
        ActionID: generateID('act'),
        deviceID: 'sensor_bedroom_001',
        userID: users[0].UserID,
        actionType: 'moving',
        details: 'Moved Snake Plant to brighter location',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        ActionID: generateID('act'),
        deviceID: 'sensor_office_001',
        userID: users[1].UserID,
        actionType: 'system',
        details: 'Updated device firmware to v1.2.0',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        ActionID: generateID('act'),
        deviceID: 'sensor_kitchen_001',
        userID: users[2].UserID,
        actionType: 'fertilizing',
        details: 'Applied organic fertilizer',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      }
    ]);
    console.log(`✅ Created ${actions.length} actions`);

    // Create User Feedback
    console.log('💬 Creating user feedback...');
    const feedback = await UserFeedback.create([
      {
        FeedbackID: generateID('fb'),
        UserID: users[0].UserID,
        RecommendationID: recommendations[0]?.recommendationID || generateID('rec'),
        Response: 'This recommendation was very helpful! My plant looks much better now.',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        FeedbackID: generateID('fb'),
        UserID: users[1].UserID,
        RecommendationID: recommendations[1]?.recommendationID || generateID('rec'),
        Response: 'The suggestion about lighting was accurate. Thank you!',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ]);
    console.log(`✅ Created ${feedback.length} user feedback entries`);

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
    console.log(`   💬 Feedback: ${feedback.length}`);

    console.log('\n🔑 Demo Login Credentials:');
    console.log('   Email: demo@email.com');
    console.log('   Password: password123');
    console.log('   Email: alice@email.com');
    console.log('   Password: password123');

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔗 Database connection closed');
    process.exit(0);
  }
};

// Run the script
createSampleData();