const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();
const syncRoutes = require('./routes/sync');
const connectDB = require('./config/database');

// Route imports
const authRoutes = require('./routes/auth');
const plantRoutes = require('./routes/plants');
const deviceRoutes = require('./routes/devices');
const analysisRoutes = require('./routes/analysis');
const recommendationRoutes = require('./routes/recommendations');
const plantImageRoutes = require('./routes/plantImages');
const actionRoutes = require('./routes/actions');
const deviceAssignmentRoutes = require('./routes/deviceAssignments');
const predictionRoutes = require('./routes/prediction');
const predictionController = require('./controllers/predictionController');
const sensorRoutes = require('./routes/sensors');
const ThingSpeakSync = require('./services/thingspeakSync');
const thingspeakRoutes = require('./routes/thingspeak');
const predictionScheduleRoutes = require('./routes/predictionSchedule');

// Connect to database
connectDB();

const app = express();

// ✅ ADDED — DISABLE CACHE FOR ALL ROUTES
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.API_RATE_LIMIT || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check route
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    success: true,
    message: 'BotaniAI Backend is running! 🚀',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    services: {
      predictions: 'Active',
      sensors: 'Active',
      thingspeak: 'Active'
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/deviceassignments', deviceAssignmentRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/plant-images', plantImageRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/predict', predictionRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/thingspeak', thingspeakRoutes);
app.use('/api/predict-schedule', predictionScheduleRoutes);

// Start services after DB connection is established
if (process.env.NODE_ENV !== 'test') {
  const mongoose = require('mongoose');
  const cron = require('node-cron');
  
  mongoose.connection.on('connected', async () => {
    console.log('✅ Database connected, starting services...');
    
    try {
      // Start ThingSpeak sync with delay
      setTimeout(() => {
        console.log('🚀 Starting ThingSpeak sync service...');
        if (ThingSpeakSync && typeof ThingSpeakSync.start === 'function') {
          ThingSpeakSync.start();
        } else {
          console.warn('⚠️ ThingSpeakSync not properly configured');
        }
      }, 5000);
      
      // Wait a bit before starting prediction service
      setTimeout(async () => {
        console.log('🤖 Starting prediction service...');
        
        try {
          // Initialize prediction service
          await predictionController.init();
          console.log('✅ Prediction service initialized successfully');
          
          // Schedule periodic predictions (toutes les heures)
          cron.schedule('0 * * * *', async () => {
            console.log('🔄 Running scheduled predictions...');
            try {
              const result = await predictionController.runPeriodicPredictions();
              console.log(`✅ Scheduled predictions completed: ${result.stats.successfulPredictions} successful`);
            } catch (error) {
              console.error('❌ Scheduled predictions failed:', error.message);
            }
          });
          
          // Schedule cleanup of old predictions (daily at 2 AM)
          cron.schedule('0 2 * * *', async () => {
            console.log('🧹 Running daily cleanup of old predictions...');
            try {
              const result = await predictionController.cleanupOldPredictions(30);
              console.log(`✅ Cleanup completed: ${result.deletedCount} predictions deleted`);
            } catch (error) {
              console.error('❌ Cleanup failed:', error.message);
            }
          });
          
        } catch (error) {
          console.error('❌ Failed to initialize prediction service:', error.message);
        }
        
      }, 10000); // Wait 10 seconds after DB connection
      
    } catch (error) {
      console.error('❌ Error starting services:', error);
    }
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Error:', error);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`✅ BotaniAI Backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Prediction routes: http://localhost:${PORT}/api/predict`);
  console.log(`📍 Sensor routes: http://localhost:${PORT}/api/sensors`);
  console.log(`📍 Prediction schedule: http://localhost:${PORT}/api/predict-schedule`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log('📡 Waiting for database connection...');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;