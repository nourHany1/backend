const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');
const Ride = require('../models/Ride');

// Create a new driver
router.post('/', async (req, res) => {
  try {
    const driver = new Driver(req.body);
    await driver.save();
    res.status(201).json(driver);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update driver location
router.put('/:id/location', async (req, res) => {
  try {
    const { longitude, latitude } = req.body;
    
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { 
        currentLocation: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        lastUpdated: Date.now()
      },
      { new: true }
    );
    
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }
    
    res.json(driver);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get driver's active rides
router.get('/:id/active-rides', async (req, res) => {
  try {
    const rides = await Ride.find({
      driver: req.params.id,
      status: { $in: ['accepted', 'in_progress'] }
    });
    
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get driver's ride history
router.get('/:id/ride-history', async (req, res) => {
  try {
    const rides = await Ride.find({
      driver: req.params.id
    }).sort({ createdAt: -1 });
    
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all drivers (for admin)
router.get('/', async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;