const mongoose = require('mongoose');

const plantImageSchema = new mongoose.Schema({
  ImageID: {
    type: String,
    required: true,
    unique: true
  },
  PlantID: {
    type: String,
    ref: 'Plant',
    required: true
  },
  ImageURL: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  AnalysisScore: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  }
}, {
  timestamps: true
});

// Method to run visual analysis
plantImageSchema.methods.runVisualAnalysis = function() {
  // This would integrate with your computer vision model
  // For academic purposes, return a mock score
  const mockScore = 3 + Math.floor(Math.random() * 2); // 3-5
  this.AnalysisScore = mockScore;
  return this.save();
};

// Method to link to plant
plantImageSchema.methods.linkToPlant = function(plantID) {
  this.PlantID = plantID;
  return this.save();
};

module.exports = mongoose.model('PlantImage', plantImageSchema);