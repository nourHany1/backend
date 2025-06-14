const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Trip = require('../models/Trip');
const RideBooking = require('../models/RideBooking');

// إنشاء مستخدم جديد
router.post('/', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// الحصول على معلومات المستخدم
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// تحديث موقع المستخدم
router.patch('/:userId/location', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    user.currentLocation = {
      type: 'Point',
      coordinates: [req.body.longitude, req.body.latitude]
    };

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// الحصول على رحلات السائق
router.get('/:userId/trips', async (req, res) => {
  try {
    const trips = await Trip.find({ driver: req.params.userId })
      .populate('passengers.rider', 'name rating')
      .sort({ createdAt: -1 });
    res.json(trips);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// الحصول على حجوزات الراكب
router.get('/:userId/bookings', async (req, res) => {
  try {
    const bookings = await RideBooking.find({ rider: req.params.userId })
      .populate('trip')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// تحديث تقييم المستخدم
router.patch('/:userId/rating', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const { rating } = req.body;
    const currentRating = user.rating || 5;
    const newRating = (currentRating + rating) / 2;
    
    user.rating = newRating;
    await user.save();

    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router; 