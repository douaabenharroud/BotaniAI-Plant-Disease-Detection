const mongoose = require('mongoose');

const userFeedbackSchema = new mongoose.Schema({
  FeedbackID: {
    type: String,
    required: true,
    unique: true
  },
  UserID: {
    type: String,
    ref: 'User',
    required: true
  },
  RecommendationID: {
    type: String,
    ref: 'Recommendations',
    required: true
  },
  Response: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Method to submit feedback
userFeedbackSchema.methods.submitFeedback = function(response) {
  this.Response = response;
  return this.save();
};

// Method to analyze feedback (basic sentiment analysis)
userFeedbackSchema.methods.analyzeFeedback = function() {
  const positiveWords = ['good', 'great', 'excellent', 'helpful', 'useful', 'thanks'];
  const negativeWords = ['bad', 'poor', 'useless', 'unhelpful', 'wrong'];
  
  const response = this.Response.toLowerCase();
  let sentiment = 'neutral';
  let score = 0;
  
  positiveWords.forEach(word => {
    if (response.includes(word)) score++;
  });
  
  negativeWords.forEach(word => {
    if (response.includes(word)) score--;
  });
  
  if (score > 0) sentiment = 'positive';
  else if (score < 0) sentiment = 'negative';
  
  return {
    sentiment,
    score,
    wordCount: response.split(' ').length
  };
};

module.exports = mongoose.model('UserFeedback', userFeedbackSchema);