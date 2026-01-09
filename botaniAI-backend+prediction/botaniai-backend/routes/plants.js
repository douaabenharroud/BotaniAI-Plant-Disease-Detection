const express = require('express');
const Plant = require('../models/Plant');
const DeviceAssignment = require('../models/DeviceAssignment');
const { protect } = require('../middleware/auth');
const { generateID } = require('../utils/idGenerator');
const axios = require('axios');

const router = express.Router();

// =====================================================
// 📌 GET ALL PLANTS FOR CURRENT USER
// =====================================================
router.get('/', protect, async (req, res) => {
  try {
    const plants = await Plant.find({ userID: req.user.id });
    res.status(200).json(plants);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching plants',
      error: error.message,
    });
  }
});

// =====================================================
// 📌 CREATE NEW PLANT (SensorID removed)
// =====================================================
router.post('/', protect, async (req, res) => {
  try {
    const {
      PlantType,
      PlantName,
      ideal_temperature_min,
      ideal_temperature_max,
      ideal_humidity_min,
      ideal_humidity_max,
      ideal_soil_moisture_min,
      ideal_soil_moisture_max,
      ideal_light_intensity_min,
      ideal_light_intensity_max,
      description,
      thingSpeakChannelID,
      thingSpeakAPIKey
    } = req.body;

    // Create plant only
    const newPlant = await Plant.create({
      PlantID: generateID("PLANT"),
      PlantType,
      PlantName,
      ideal_temperature_min,
      ideal_temperature_max,
      ideal_humidity_min,
      ideal_humidity_max,
      ideal_soil_moisture_min,
      ideal_soil_moisture_max,
      ideal_light_intensity_min,
      ideal_light_intensity_max,
      description,
      userID: req.user.id,
      thingSpeakChannelID,
      thingSpeakAPIKey
    });

    res.status(201).json({
      message: 'Plant created successfully',
      data: newPlant,
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error creating plant',
      error: error.message,
    });
  }
});

// =====================================================
// 📌 GET PLANT BY ID
// =====================================================
router.get('/:id', protect, async (req, res) => {
  try {
    const plant = await Plant.findOne({
      _id: req.params.id,
      userID: req.user.id
    });

    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }

    res.status(200).json(plant);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching plant details',
      error: error.message,
    });
  }
});

// =====================================================
// 📌 FETCH LATEST THINGSPEAK DATA FOR A PLANT
// =====================================================
router.get('/:id/thingspeak', protect, async (req, res) => {
  try {
    const plant = await Plant.findOne({ _id: req.params.id, userID: req.user.id });

    if (!plant) return res.status(404).json({ message: 'Plant not found' });

    if (!plant.thingSpeakChannelID || !plant.thingSpeakAPIKey)
      return res.status(400).json({ message: 'ThingSpeak info not set for this plant' });

    const url = `https://api.thingspeak.com/channels/${plant.thingSpeakChannelID}/feeds/last.json?api_key=${plant.thingSpeakAPIKey}`;
    const response = await axios.get(url);

    res.status(200).json({ plantID: plant._id, data: response.data });

  } catch (error) {
    res.status(500).json({
      message: 'Error fetching ThingSpeak data',
      error: error.message,
    });
  }
});

// =====================================================
// 📌 DELETE PLANT
// =====================================================
router.delete('/:id', protect, async (req, res) => {
  try {
    const plant = await Plant.findOneAndDelete({
      _id: req.params.id,
      userID: req.user.id,
    });

    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }

    res.status(200).json({
      message: 'Plant deleted successfully',
    });

  } catch (error) {
    res.status(500).json({
      message: 'Error deleting plant',
      error: error.message,
    });
  }
});

module.exports = router;
