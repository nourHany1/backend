const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const User = require('../models/User');
const { startLocationTracking, stopLocationTracking } = require('../services/locationService');

// إنشاء رحلة جديدة
router.post('/', async (req, res) => {
  try {
    const trip = new Trip(req.body);
    await trip.save();
    
    // بدء تتبع موقع السائق
    const trackingInterval = startLocationTracking(trip.driver, trip._id);
    
    res.status(201).json({ trip, trackingInterval });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// البحث عن رحلات قريبة
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

// إضافة راكب إلى الرحلة
router.post('/:tripId/riders', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'الرحلة غير موجودة' });
    }

    const rider = await User.findById(req.body.userId);
    if (!rider) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
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

// تحديث حالة الرحلة
router.patch('/:tripId/status', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'الرحلة غير موجودة' });
    }

    trip.status = req.body.status;
    
    // إذا تم إكمال الرحلة، نقوم بإيقاف تتبع الموقع
    if (req.body.status === 'completed') {
      stopLocationTracking(trip.trackingInterval);
    }

    await trip.save();
    res.json(trip);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// تحديث حالة راكب معين
router.patch('/:tripId/riders/:riderId/status', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'الرحلة غير موجودة' });
    }

    const rider = trip.riders.id(req.params.riderId);
    if (!rider) {
      return res.status(404).json({ message: 'الراكب غير موجود في هذه الرحلة' });
    }

    rider.status = req.body.status;
    await trip.save();
    res.json(trip);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// الحصول على تفاصيل الرحلة
router.get('/:tripId', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.tripId)
      .populate('driver', 'name phone rating currentLocation')
      .populate('riders.user', 'name phone currentLocation');
    
    if (!trip) {
      return res.status(404).json({ message: 'الرحلة غير موجودة' });
    }

    res.json(trip);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 