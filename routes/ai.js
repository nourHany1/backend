const express = require("express");
const router = express.Router();
const RideRequest = require("../models/RideRequest");
const RideMatchSuggestion = require("../models/RideMatchSuggestion");
const User = require("../models/User");
const Driver = require("../models/Driver");

// Endpoint for AI model to send back match suggestions (internal/webhook)
router.post("/match-suggestions", async (req, res) => {
  try {
    const { rideRequestId, suggestedDriverId, suggestedTripId, potentialRiders, optimizedRoute, totalEstimatedTime, totalEstimatedCost } = req.body;

    const newMatchSuggestion = new RideMatchSuggestion({
      rideRequestId,
      suggestedDriverId,
      suggestedTripId,
      potentialRiders,
      optimizedRoute,
      totalEstimatedTime,
      totalEstimatedCost,
    });
    await newMatchSuggestion.save();

    // Update the status of the original ride request
    await RideRequest.findByIdAndUpdate(rideRequestId, { status: "matched" });

    // Emit Socket.IO event to the rider with the suggestion
    const io = require("../socket").getIO();
    io.to(rideRequestId).emit("newRideMatchSuggestion", {
      rideId: newMatchSuggestion._id,
      driverInfo: suggestedDriverId, // You might want to populate this with actual driver details
      currentRiders: potentialRiders, // You might want to populate this with actual rider details
      estimatedPickupTime: new Date(), // Placeholder, AI should provide this
      estimatedDropoffTime: new Date(Date.now() + totalEstimatedTime * 60 * 1000), // Placeholder
      estimatedCost: totalEstimatedCost,
      potentialDelay: 0, // Placeholder
    });

    res.status(200).json({ status: "success", message: "Matching suggestions received and processed." });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
