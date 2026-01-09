const express = require('express');
const router = express.Router();
const Recommendation = require('../models/Recommendation');

// CREATE recommendation
router.post('/', async (req, res) => {
  try {
    const rec = await Recommendation.create(req.body);
    res.json({ success: true, message: "Recommendation added", data: rec });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to add recommendation", error: err.message });
  }
});

// GET all recommendations
router.get('/', async (req, res) => {
  const recs = await Recommendation.find();
  res.json({ success: true, data: recs });
});

// GET one recommendation by class
router.get('/:class', async (req, res) => {
  const rec = await Recommendation.findOne({ class: req.params.class });
  if (!rec) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: rec });
});

// UPDATE recommendation
router.put('/:id', async (req, res) => {
  try {
    const updated = await Recommendation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, message: "Recommendation updated", data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Update failed", error: err.message });
  }
});

// DELETE recommendation
router.delete('/:id', async (req, res) => {
  try {
    await Recommendation.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Recommendation deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Delete failed", error: err.message });
  }
});

module.exports = router;
