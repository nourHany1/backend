const mongoose = require("mongoose");

const rideRequestSchema = new mongoose.Schema(
  {
    pickupLocation: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    dropoffLocation: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    passengers: {
      type: Number,
      required: true,
      min: 1,
    },
    preferences: {
      allowSharing: {
        type: Boolean,
        default: true,
      },
      genderPreference: {
        type: String,
        enum: ["same", "any"],
        default: "any",
      },
      maxDelay: {
        type: Number,
        default: 10, // minutes
      },
      maxPassengers: {
        type: Number,
        default: 4,
      },
      routeOptimization: {
        priority: {
          type: String,
          enum: ["time", "cost", "comfort"],
          default: "time",
        },
        maxDetour: {
          type: Number,
          default: 5, // kilometers
        },
      },
      comfortLevel: {
        type: String,
        enum: ["basic", "premium", "luxury"],
        default: "basic",
      },
    },
    status: {
      type: String,
      enum: ["pending", "matched", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
    estimatedPrice: {
      type: Number,
      default: 0,
    },
    actualPrice: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Add geospatial index
rideRequestSchema.index({ pickupLocation: "2dsphere" });
rideRequestSchema.index({ dropoffLocation: "2dsphere" });

// Add index for quick search
rideRequestSchema.index({ status: 1, createdAt: -1 });
rideRequestSchema.index({ riderId: 1, status: 1 });

const RideRequest = mongoose.model("RideRequest", rideRequestSchema);

module.exports = RideRequest;
