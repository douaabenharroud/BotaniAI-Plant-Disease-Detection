const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
  AnalysisID: {
    type: String,
    required: true,
    unique: true
  },
  deviceID: {
    type: String,
    required: true
  },
  TimeStamp: {
    type: Date,
    default: Date.now
  },
  HealthScore: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  anomalyDetected: {
    type: Boolean,
    default: false
  },
  predictedIssues: [String],
  confidenceScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  }
}, {
  timestamps: true
});

// Method to run analysis (to be implemented with AI logic)
analysisSchema.methods.runAnalysis = async function(reading) {
  // This would contain your AI analysis logic
  const healthScore = await this.generateHealthScore(reading);
  const anomalies = await this.detectAnomalies(reading);
  
  this.HealthScore = healthScore;
  this.anomalyDetected = anomalies;
  this.confidenceScore = 0.85; // Example confidence score
  
  return this.save();
};

// Method to generate health score
analysisSchema.methods.generateHealthScore = async function(reading) {
  // Simplified health score calculation
  // In practice, this would use your AI model
  let score = 5;
  
  if (reading.temperature < 18 || reading.temperature > 28) score -= 1;
  if (reading.humidity < 30 || reading.humidity > 70) score -= 1;
  if (reading.soilMoisture < 1000) score -= 1;
  if (reading.lightIntensity < 200) score -= 1;
  
  return Math.max(1, score);
};

// Method to detect anomalies
analysisSchema.methods.detectAnomalies = async function(reading) {
  // Simplified anomaly detection
  return (
    reading.temperature > 35 ||
    reading.temperature < 10 ||
    reading.humidity > 90 ||
    reading.humidity < 20 ||
    reading.soilMoisture > 3500
  );
};

module.exports = mongoose.model('Analysis', analysisSchema);