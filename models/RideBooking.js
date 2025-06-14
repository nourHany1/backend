const mongoose = require('mongoose');

const rideBookingSchema = new mongoose.Schema({
  rider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  pickupLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: String
  },
  dropoffLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: String
  },
  price: {
    type: Number,
    required: true
  },
  estimatedDuration: {
    type: Number, // in minutes
    required: true
  },
  estimatedDistance: {
    type: Number, // in kilometers
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: String
}, { timestamps: true });

rideBookingSchema.index({ pickupLocation: '2dsphere' });
rideBookingSchema.index({ dropoffLocation: '2dsphere' });

module.exports = mongoose.model('RideBooking', rideBookingSchema); 