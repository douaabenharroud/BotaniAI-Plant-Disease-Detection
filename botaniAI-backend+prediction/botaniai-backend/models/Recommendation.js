const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  class: {
    type: Number,
    required: true,
    unique: true,
    min: 0,
    max: 5
  },
  text: {
    type: String,
    required: true
  },
  plantType: {
    type: String,
    default: 'general'
  }
}, {
  timestamps: true
});

// Create index for faster queries
recommendationSchema.index({ class: 1 });

module.exports = mongoose.model('Recommendation', recommendationSchema);