const express = require("express");
const router = express.Router();
const RideRequest = require("../models/RideRequest");
const RideMatchSuggestion = require("../models/RideMatchSuggestion");
const User = require("../models/User");
const Driver = require("../models/Driver");

// Endpoint to initiate a new ride request
router.post("/request", async (req, res) => {
  try {
    const newRideRequest = new RideRequest(req.body);
    await newRideRequest.save();
    res.status(202).json({
      rideRequestId: newRideRequest._id,
      status: "pending_ai_matching",
      message: "Your ride request is being processed for optimal matching.",
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Endpoint for rider to accept/reject a match
router.post("/:rideId/accept-match", async (req, res) => {
  try {
    const { riderId, acceptedMatch } = req.body;
    const rideId = req.params.rideId;

    await RideMatchSuggestion.findByIdAndUpdate(rideId, { status: acceptedMatch ? "accepted" : "rejected" });

    const io = require("../socket").getIO();
    io.to(rideId).emit("riderMatchStatusUpdate", {
      riderId,
      status: acceptedMatch ? "accepted" : "rejected",
      message: acceptedMatch ? "Rider accepted the match." : "Rider rejected the match.",
    });

    res.status(200).json({ status: "success", message: "Match acceptance status updated." });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Endpoint to get active match suggestions for a rider
router.get("/active-matches/:riderId", async (req, res) => {
  try {
    const activeMatches = await RideMatchSuggestion.find({
      potentialRiders: { $elemMatch: { riderId: req.params.riderId } },
      status: "pending",
    }).populate("suggestedDriverId").populate("potentialRiders.riderId"); // Populate driver and rider details

    res.status(200).json(activeMatches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

