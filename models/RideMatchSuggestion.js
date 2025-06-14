const mongoose = require("mongoose");

const rideMatchSuggestionSchema = new mongoose.Schema({
  rideRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RideRequest",
    required: true,
  },
  suggestedDriverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
  },
  suggestedTripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Trip",
  },
  potentialRiders: [
    {
      riderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      estimatedDelayMinutes: {
        type: Number,
      },
    },
  ],
  optimizedRoute: {
    type: Object, // Can be GeoJSON or a custom route object
  },
  totalEstimatedTime: {
    type: Number,
  },
  totalEstimatedCost: {
    type: Number,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "expired"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

rideMatchSuggestionSchema.index({ "optimizedRoute.coordinates": "2dsphere" });

module.exports = mongoose.model("RideMatchSuggestion", rideMatchSuggestionSchema);
