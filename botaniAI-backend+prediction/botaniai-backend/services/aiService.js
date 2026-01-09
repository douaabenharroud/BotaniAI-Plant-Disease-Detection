const Recommendation = require('../models/Recommendation');
const Plant = require('../models/Plant');
const SensorData = require('../models/SensorData');
const ThingSpeakService = require('./thingspeakService');

class AIService {
  constructor() {
    this.healthThresholds = {
      temperature: { optimal: [18, 26], weight: 0.25 },
      humidity: { optimal: [40, 60], weight: 0.25 },
      soilMoisture: { optimal: [1000, 3000], weight: 0.3 },
      lightIntensity: { optimal: [200, 800], weight: 0.2 }
    };
  }

  // Analyze plant health based on sensor data
  async analyzePlantHealth(plantId, sensorData) {
    try {
      const plant = await Plant.findById(plantId);
      if (!plant) {
        console.error(`Plant ${plantId} not found for AI analysis`);
        return;
      }

      const optimalRanges = plant.optimalRanges;
      const analysis = this.calculateHealthScore(sensorData, optimalRanges);
      
      // Update plant health score
      await Plant.findByIdAndUpdate(plantId, { 
        healthScore: analysis.healthScore 
      });

      // Create recommendation if needed
      if (analysis.healthScore <= 3 || analysis.issues.length > 0) {
        await this.createRecommendation(plantId, analysis);
      }

      console.log(`🤖 AI Analysis for ${plant.name}: ${analysis.healthScore}/5`);
      return analysis;

    } catch (error) {
      console.error('AI analysis error:', error);
    }
  }

  // Calculate health score (1-5)
  calculateHealthScore(sensorData, optimalRanges) {
    const { temperature, humidity, soilMoisture, lightIntensity } = sensorData;
    let totalScore = 0;
    let issues = [];
    let recommendations = [];

    // Temperature analysis
    const tempScore = this.calculateParameterScore(
      temperature, 
      optimalRanges.temperature.min, 
      optimalRanges.temperature.max,
      'temperature'
    );
    totalScore += tempScore.score * this.healthThresholds.temperature.weight;
    if (tempScore.issue) issues.push(tempScore.issue);
    if (tempScore.recommendation) recommendations.push(tempScore.recommendation);

    // Humidity analysis
    const humidityScore = this.calculateParameterScore(
      humidity,
      optimalRanges.humidity.min,
      optimalRanges.humidity.max,
      'humidity'
    );
    totalScore += humidityScore.score * this.healthThresholds.humidity.weight;
    if (humidityScore.issue) issues.push(humidityScore.issue);
    if (humidityScore.recommendation) recommendations.push(humidityScore.recommendation);

    // Soil moisture analysis
    const soilScore = this.calculateParameterScore(
      soilMoisture,
      optimalRanges.soilMoisture.min,
      optimalRanges.soilMoisture.max,
      'soilMoisture'
    );
    totalScore += soilScore.score * this.healthThresholds.soilMoisture.weight;
    if (soilScore.issue) issues.push(soilScore.issue);
    if (soilScore.recommendation) recommendations.push(soilScore.recommendation);

    // Light analysis
    const lightScore = this.calculateParameterScore(
      lightIntensity,
      optimalRanges.lightIntensity.min,
      optimalRanges.lightIntensity.max,
      'lightIntensity'
    );
    totalScore += lightScore.score * this.healthThresholds.lightIntensity.weight;
    if (lightScore.issue) issues.push(lightScore.issue);
    if (lightScore.recommendation) recommendations.push(lightScore.recommendation);

    // Convert to 1-5 scale
    const healthScore = Math.max(1, Math.min(5, Math.round(totalScore * 5)));

    return {
      healthScore,
      issues,
      recommendations,
      parameterScores: {
        temperature: tempScore.score,
        humidity: humidityScore.score,
        soilMoisture: soilScore.score,
        lightIntensity: lightScore.score
      }
    };
  }

  // Calculate score for individual parameter (0-1)
  calculateParameterScore(value, min, max, parameter) {
    let score = 1;
    let issue = null;
    let recommendation = null;

    if (value < min) {
      // Below optimal range
      const deviation = (min - value) / min;
      score = Math.max(0, 1 - deviation);
      
      issue = `low_${parameter}`;
      recommendation = this.getRecommendation(parameter, 'low', value, min, max);
    } else if (value > max) {
      // Above optimal range
      const deviation = (value - max) / max;
      score = Math.max(0, 1 - deviation);
      
      issue = `high_${parameter}`;
      recommendation = this.getRecommendation(parameter, 'high', value, min, max);
    }

    return { score, issue, recommendation };
  }

  // Get specific recommendations
  getRecommendation(parameter, condition, value, min, max) {
    const recommendations = {
      temperature: {
        low: `Increase temperature (current: ${value}°C, optimal: ${min}-${max}°C)`,
        high: `Decrease temperature (current: ${value}°C, optimal: ${min}-${max}°C)`
      },
      humidity: {
        low: `Increase humidity (current: ${value}%, optimal: ${min}-${max}%)`,
        high: `Decrease humidity (current: ${value}%, optimal: ${min}-${max}%)`
      },
      soilMoisture: {
        low: `Water the plant (soil moisture: ${value}, optimal: ${min}-${max})`,
        high: `Reduce watering (soil moisture: ${value}, optimal: ${min}-${max})`
      },
      lightIntensity: {
        low: `Increase light exposure (current: ${value}, optimal: ${min}-${max})`,
        high: `Reduce light exposure (current: ${value}, optimal: ${min}-${max})`
      }
    };

    return recommendations[parameter]?.[condition] || `Adjust ${parameter} levels`;
  }

  // Create recommendation in database
  async createRecommendation(plantId, analysis) {
    try {
      const plant = await Plant.findById(plantId);
      
      const priority = analysis.healthScore <= 2 ? 'high' : 
                      analysis.healthScore <= 3 ? 'medium' : 'low';

      const recommendation = new Recommendation({
        plant: plantId,
        healthScore: analysis.healthScore,
        message: `Plant health score: ${analysis.healthScore}/5. ${analysis.issues.length > 0 ? 
          'Issues detected: ' + analysis.issues.join(', ') : 'No major issues detected.'}`,
        actions: analysis.recommendations,
        priority: priority
      });

      await recommendation.save();
      return recommendation;

    } catch (error) {
      console.error('Error creating recommendation:', error);
    }
  }

  // Get health insights and trends
  async getHealthInsights(plantId, days = 7) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const historicalData = await SensorData.find({
        plant: plantId,
        timestamp: { $gte: startDate, $lte: endDate }
      }).sort({ timestamp: 1 });

      if (historicalData.length === 0) {
        return this.generateMockInsights();
      }

      return this.analyzeTrends(historicalData);
    } catch (error) {
      console.error('Error getting health insights:', error);
      return this.generateMockInsights();
    }
  }

  // Analyze trends from historical data
  analyzeTrends(data) {
    const trends = {
      temperature: this.calculateTrend(data.map(d => d.temperature)),
      humidity: this.calculateTrend(data.map(d => d.humidity)),
      soilMoisture: this.calculateTrend(data.map(d => d.soilMoisture)),
      lightIntensity: this.calculateTrend(data.map(d => d.lightIntensity))
    };

    return {
      overallTrend: this.determineOverallTrend(trends),
      parameterTrends: trends,
      riskLevel: this.calculateRiskLevel(trends),
      predictedIssues: this.predictIssues(trends),
      maintenanceSchedule: this.generateMaintenanceSchedule(trends)
    };
  }

  // Calculate trend (improving, stable, declining)
  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const difference = avgSecond - avgFirst;
    const percentageChange = (difference / avgFirst) * 100;

    if (Math.abs(percentageChange) < 5) return 'stable';
    return percentageChange > 0 ? 'improving' : 'declining';
  }

  determineOverallTrend(trends) {
    const trendValues = Object.values(trends);
    const improving = trendValues.filter(t => t === 'improving').length;
    const declining = trendValues.filter(t => t === 'declining').length;

    if (improving > declining) return 'improving';
    if (declining > improving) return 'declining';
    return 'stable';
  }

  calculateRiskLevel(trends) {
    const decliningParams = Object.values(trends).filter(t => t === 'declining').length;
    
    if (decliningParams >= 3) return 'high';
    if (decliningParams >= 2) return 'medium';
    return 'low';
  }

  predictIssues(trends) {
    const issues = [];
    
    if (trends.soilMoisture === 'declining') {
      issues.push('Potential dehydration risk in next 2-3 days');
    }
    if (trends.temperature === 'declining') {
      issues.push('Temperature dropping below optimal range');
    }
    if (trends.lightIntensity === 'declining') {
      issues.push('Insufficient light exposure detected');
    }

    return issues;
  }

  generateMaintenanceSchedule(trends) {
    const schedule = [];
    
    schedule.push('Daily: Check soil moisture levels');
    schedule.push('Weekly: Inspect leaves for discoloration');
    
    if (trends.soilMoisture === 'declining') {
      schedule.push('Next 2 days: Increase watering frequency');
    }
    if (trends.lightIntensity === 'declining') {
      schedule.push('Immediate: Move to brighter location');
    }

    return schedule;
  }

  // Generate mock insights for academic demonstration
  generateMockInsights() {
    const trends = ['improving', 'stable', 'declining'];
    const riskLevels = ['low', 'medium', 'high'];
    
    return {
      overallTrend: trends[Math.floor(Math.random() * trends.length)],
      parameterTrends: {
        temperature: trends[Math.floor(Math.random() * trends.length)],
        humidity: trends[Math.floor(Math.random() * trends.length)],
        soilMoisture: trends[Math.floor(Math.random() * trends.length)],
        lightIntensity: trends[Math.floor(Math.random() * trends.length)]
      },
      riskLevel: riskLevels[Math.floor(Math.random() * riskLevels.length)],
      predictedIssues: [
        'Monitor soil moisture levels',
        'Check light exposure patterns'
      ],
      maintenanceSchedule: [
        'Daily: Visual inspection',
        'Weekly: Soil quality check',
        'Monthly: Fertilizer application'
      ]
    };
  }
}

module.exports = new AIService();