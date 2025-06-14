const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const Driver = require('../models/Driver');
const Notification = require('../models/Notification');

// Create a new ride request
router.post('/', async (req, res) => {
  try {
    const { passenger, pickupLocation, dropoffLocation } = req.body;
    
    // Find the nearest available driver
    const nearestDrivers = await Driver.find({
      available: true,
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: pickupLocation.coordinates
          }
        }
      }
    }).limit(1);
    
    if (nearestDrivers.length === 0) {
      return res.status(404).json({ message: 'No drivers available' });
    }
    
    const driver = nearestDrivers[0];
    
    // Create the ride
    const ride = new Ride({
      passenger,
      driver: driver._id,
      pickupLocation,
      dropoffLocation
    });
    
    await ride.save();
    
    // Create notification for driver
    const notification = new Notification({
      driver: driver._id,
      ride: ride._id,
      message: `New ride request from ${passenger.name}`
    });
    
    await notification.save();
    
    res.status(201).json(ride);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update ride status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found' });
    }
    
    res.json(ride);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get passenger's ride history
router.get('/passenger/:name', async (req, res) => {
  try {
    const rides = await Ride.find({
      'passenger.name': req.params.name
    }).sort({ createdAt: -1 });
    
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all rides (for admin)
router.get('/', async (req, res) => {
  try {
    const rides = await Ride.find().populate('driver');
    res.json(rides);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;