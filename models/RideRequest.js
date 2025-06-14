const mongoose = require("mongoose");

const rideRequestSchema = new mongoose.Schema({
  riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  origin: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  destination: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  passengers: {
    type: Number,
    required: true,
    min: 1,
  },
  preferredTime: {
    type: Date,
  },
  status: {
    type: String,
    enum: ["pending_ai_matching", "matched", "rejected", "cancelled"],
    default: "pending_ai_matching",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("RideRequest", rideRequestSchema);
