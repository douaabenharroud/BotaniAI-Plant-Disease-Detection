const mongoose = require('mongoose');

const plantSchema = new mongoose.Schema({
  PlantID: {
    type: String,
    required: true,
    unique: true
  },
  PlantType: {
    type: String,
    required: true
  },
  PlantName: {
    type: String,
    required: true
  },

  userID: {
    type: String,
    required: true
  },

  ideal_temperature_min: Number,
  ideal_temperature_max: Number,
  ideal_humidity_min: Number,
  ideal_humidity_max: Number,
  ideal_soil_moisture_min: Number,
  ideal_soil_moisture_max: Number,
  ideal_light_intensity_min: Number,
  ideal_light_intensity_max: Number,

  description: String,

  // 🌱 ThingSpeak integration
  thingSpeakChannelID: { type: String },
  thingSpeakAPIKey: { type: String },

}, {
  timestamps: true
});

plantSchema.methods.checkConditions = function (reading) {
  const { temperature, humidity, soilMoisture, lightIntensity } = reading;

  return {
    temperature: temperature >= this.ideal_temperature_min && temperature <= this.ideal_temperature_max,
    humidity: humidity >= this.ideal_humidity_min && humidity <= this.ideal_humidity_max,
    soilMoisture: soilMoisture >= this.ideal_soil_moisture_min && soilMoisture <= this.ideal_soil_moisture_max,
    lightIntensity: lightIntensity >= this.ideal_light_intensity_min && lightIntensity <= this.ideal_light_intensity_max
  };
};

plantSchema.methods.getIdealRanges = function () {
  return {
    temperature: { min: this.ideal_temperature_min, max: this.ideal_temperature_max },
    humidity: { min: this.ideal_humidity_min, max: this.ideal_humidity_max },
    soilMoisture: { min: this.ideal_soil_moisture_min, max: this.ideal_soil_moisture_max },
    lightIntensity: { min: this.ideal_light_intensity_min, max: this.ideal_light_intensity_max }
  };
};

module.exports = mongoose.model('Plant', plantSchema);
