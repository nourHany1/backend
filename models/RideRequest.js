const mongoose = require("mongoose");

const rideRequestSchema = new mongoose.Schema({
  riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  pickupLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      required: true,
    },
    address: String,
  },
  dropoffLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      required: true,
    },
    address: String,
  },
  passengers: {
    type: Number,
    required: true,
    min: 1,
  },
  preferredTime: {
    type: Date,
  },
  preferences: {
    allowSharing: {
      type: Boolean,
      default: true,
    },
    maxDelay: {
      type: Number,
      default: 15, // maximum delay in minutes
    },
    genderPreference: {
      type: String,
      enum: ["any", "same", "female"],
      default: "any",
    },
    maxPassengers: {
      type: Number,
      default: 4,
    },
  },
  status: {
    type: String,
    enum: ["pending", "matched", "rejected", "cancelled", "completed"],
    default: "pending",
  },
  matchedRideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RideMatchSuggestion",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes for geospatial queries
rideRequestSchema.index({ pickupLocation: "2dsphere" });
rideRequestSchema.index({ dropoffLocation: "2dsphere" });

// Update the updatedAt timestamp before saving
rideRequestSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("RideRequest", rideRequestSchema);
