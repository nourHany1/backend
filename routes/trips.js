const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const User = require('../models/User');
const { startLocationTracking, stopLocationTracking } = require('../services/locationService');

// Create a new trip
router.post('/', async (req, res) => {
  try {
    const trip = new Trip(req.body);
    await trip.save();
    
    // Start driver location tracking
    const trackingInterval = startLocationTracking(trip.driver, trip._id);
    
    res.status(201).json({ trip });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Search for nearby trips
router.get('/nearby', async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 5000 } = req.query;
    
    const trips = await Trip.find({
      status: 'pending',
      startLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    }).populate('driver', 'name rating currentLocation');

    res.json(trips);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add a rider to the trip
router.post('/:tripId/riders', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const rider = await User.findById(req.body.userId);
    if (!rider) {
      return res.status(404).json({ message: 'User not found' });
    }

    trip.riders.push({
      user: rider._id,
      pickupLocation: req.body.pickupLocation,
      dropoffLocation: req.body.dropoffLocation
    });

    await trip.save();
    res.json(trip);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update trip status
router.patch('/:tripId/status', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    trip.status = req.body.status;
    
    // If the trip is completed, stop location tracking
    if (req.body.status === 'completed') {
      stopLocationTracking(trip.trackingInterval);
    }

    await trip.save();
    res.json(trip);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update specific rider status
router.patch('/:tripId/riders/:riderId/status', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const rider = trip.riders.id(req.params.riderId);
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found in this trip' });
    }

    rider.status = req.body.status;
    await trip.save();
    res.json(trip);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get trip details
router.get('/:tripId', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId)
      .populate('driver', 'name phone rating currentLocation')
      .populate('riders.user', 'name phone currentLocation');
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    res.json(trip);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 