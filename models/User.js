const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['driver', 'rider'],
    required: true
  },
  rating: {
    type: Number,
    default: 5.0
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  currentLocation: {
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
  // معلومات إضافية للسائق
  driverInfo: {
    carModel: String,
    carColor: String,
    licensePlate: String,
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  // معلومات إضافية للراكب
  riderInfo: {
    preferredPaymentMethod: {
      type: String,
      enum: ['cash', 'card'],
      default: 'cash'
    },
    savedLocations: [{
      name: String,
      location: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: [Number],
        address: String
      }
    }]
  },
  // سجل الرحلات
  tripHistory: [{
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip'
    },
    role: {
      type: String,
      enum: ['driver', 'rider']
    },
    status: {
      type: String,
      enum: ['completed', 'cancelled']
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  // إعدادات الإشعارات
  notifications: {
    pushEnabled: {
      type: Boolean,
      default: true
    },
    emailEnabled: {
      type: Boolean,
      default: true
    }
  }
}, { timestamps: true });

// فهارس للبحث السريع
userSchema.index({ currentLocation: '2dsphere' });
userSchema.index({ 'riderInfo.savedLocations.location': '2dsphere' });

module.exports = mongoose.model('User', userSchema); 