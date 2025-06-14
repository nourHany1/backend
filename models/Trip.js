const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  startLocation: {
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
  endLocation: {
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
  driverLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  riders: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    pickupLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number],
      address: String
    },
    dropoffLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number],
      address: String
    },
    status: {
      type: String,
      enum: ['pending', 'picked_up', 'dropped_off', 'cancelled'],
      default: 'pending'
    },
    fare: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String
  }],
  distance: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0
  },
  totalFare: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  route: {
    type: {
      type: String,
      enum: ['LineString'],
      default: 'LineString'
    },
    coordinates: [[Number]]
  },
  estimatedArrivalTime: Date,
  actualArrivalTime: Date,
  notes: String
}, { timestamps: true });

tripSchema.index({ startLocation: '2dsphere' });
tripSchema.index({ endLocation: '2dsphere' });
tripSchema.index({ driverLocation: '2dsphere' });
tripSchema.index({ 'riders.pickupLocation': '2dsphere' });
tripSchema.index({ 'riders.dropoffLocation': '2dsphere' });

module.exports = mongoose.model('Trip', tripSchema); 