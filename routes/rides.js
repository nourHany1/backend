const express = require("express");
const router = express.Router();
const RideRequest = require("../models/RideRequest");
const RideMatchSuggestion = require("../models/RideMatchSuggestion");
const User = require("../models/User");
const Driver = require("../models/Driver");
const { body, validationResult } = require("express-validator");
const aiMatchingService = require("../services/aiMatchingService");

// Endpoint to initiate a new ride request
router.post(
  "/request",
  [
    body("pickupLocation")
      .notEmpty()
      .withMessage("Pickup location is required"),
    body("dropoffLocation")
      .notEmpty()
      .withMessage("Dropoff location is required"),
    body("riderId").isMongoId().withMessage("Invalid rider ID"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

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
  }
);

// Endpoint for rider to accept/reject a match
router.post(
  "/:rideId/accept-match",
  [
    body("riderId").isMongoId().withMessage("Invalid rider ID"),
    body("acceptedMatch")
      .isBoolean()
      .withMessage("Accepted match must be a boolean"),
  ],
  async (req, res) => {
    try {
      const { rideId } = req.params;
      const { riderId, acceptedMatch } = req.body;

      const match = await RideMatchSuggestion.findById(rideId);
      if (!match) {
        return res.status(404).json({ message: "Match not found" });
      }

      match.status = acceptedMatch ? "accepted" : "rejected";
      await match.save();

      res.json({ status: "success" });
    } catch (error) {
      console.error("Accept match error:", error);
      res.status(500).json({ message: "Error accepting match" });
    }
  }
);

// Endpoint to get active match suggestions for a rider
router.get("/active-matches/:riderId", async (req, res) => {
  try {
    const activeMatches = await RideMatchSuggestion.find({
      potentialRiders: { $elemMatch: { riderId: req.params.riderId } },
      status: "pending",
    })
      .populate("suggestedDriverId")
      .populate("potentialRiders.riderId");

    res.status(200).json(activeMatches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Endpoint to get AI-powered ride suggestions
router.post(
  "/suggest-matches",
  [
    body("pickupLocation")
      .notEmpty()
      .withMessage("Pickup location is required"),
    body("dropoffLocation")
      .notEmpty()
      .withMessage("Dropoff location is required"),
    body("riderId").isMongoId().withMessage("Invalid rider ID"),
    body("preferences").optional().isObject(),
    body("passengers")
      .optional()
      .isNumeric()
      .withMessage("Passengers must be a number"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        pickupLocation,
        dropoffLocation,
        riderId,
        preferences,
        passengers,
      } = req.body;

      // Create a new ride request
      const newRideRequest = new RideRequest({
        pickupLocation,
        dropoffLocation,
        riderId,
        passengers,
        preferences,
        status: "pending",
      });
      await newRideRequest.save();

      // Get AI-powered matches
      const matches = await aiMatchingService.findOptimalMatches(
        newRideRequest
      );

      res.status(200).json({
        rideRequestId: newRideRequest._id,
        matches: matches.map((match) => ({
          matchId: match._id,
          driver: match.suggestedDriverId,
          estimatedDelay: match.potentialRiders[0].estimatedDelayMinutes,
          totalEstimatedTime: match.totalEstimatedTime,
          totalEstimatedCost: match.totalEstimatedCost,
          optimizedRoute: match.optimizedRoute,
        })),
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Endpoint to get ongoing rides for potential sharing
router.get("/ongoing-rides", async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000 } = req.query;

    const ongoingRides = await RideMatchSuggestion.find({
      status: "accepted",
      "optimizedRoute.coordinates": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseInt(radius),
        },
      },
    })
      .populate("suggestedDriverId")
      .populate("potentialRiders.riderId");

    res.status(200).json(ongoingRides);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Endpoint to update ride preferences
router.put(
  "/:rideId/preferences",
  [body("preferences").isObject().withMessage("Preferences must be an object")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { preferences } = req.body;
      const rideId = req.params.rideId;

      const updatedRide = await RideRequest.findByIdAndUpdate(
        rideId,
        { preferences },
        { new: true }
      );

      if (!updatedRide) {
        return res.status(404).json({ message: "Ride request not found" });
      }

      // Trigger AI re-matching if needed
      if (preferences.allowSharing !== undefined) {
        const matches = await aiMatchingService.findOptimalMatches(updatedRide);
        return res.status(200).json({
          message: "Preferences updated and new matches found",
          matches,
        });
      }

      res.status(200).json({
        message: "Preferences updated successfully",
        ride: updatedRide,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;

