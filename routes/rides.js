const express = require("express");
const router = express.Router();
const RideRequest = require("../models/RideRequest");
const RideMatchSuggestion = require("../models/RideMatchSuggestion");
const User = require("../models/User");
const Driver = require("../models/Driver");
const { body, validationResult } = require("express-validator");
// const aiMatchingService = require("../services/aiMatchingService");
const locationService = require("../services/locationService");
const Trip = require("../models/Trip");

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

      // إنشاء طلب ركوب فقط بدون أي مطابقة
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

      // إنشاء طلب ركوب جديد
      const newRideRequest = new RideRequest({
        pickupLocation,
        dropoffLocation,
        riderId,
        passengers,
        preferences,
        status: "pending",
      });
      await newRideRequest.save();

      // تم إزالة منطق الذكاء الاصطناعي للمطابقة
      res.status(200).json({
        message: "Ride request created successfully, AI matching skipped.",
        rideRequestId: newRideRequest._id,
        status: "pending",
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
      currentLocation: {
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
        // حذف جميع المطابقات القديمة لهذا الطلب
        await RideMatchSuggestion.deleteMany({ rideRequestId: rideId });
        // إعادة حساب المطابقات
        const matches = await aiMatchingService.findOptimalMatches(updatedRide);
        const savedMatches = await Promise.all(
          matches.map(async (match) => {
            return await match.save();
          })
        );
        return res.status(200).json({
          message: "Preferences updated and new matches found",
          matches: savedMatches.map((match) => ({
            matchId: match._id,
            driver: match.suggestedDriverId,
            estimatedDelay:
              match.potentialRiders &&
              match.potentialRiders.length > 0 &&
              match.potentialRiders[0].estimatedDelayMinutes
                ? match.potentialRiders[0].estimatedDelayMinutes
                : 0,
            totalEstimatedTime: match.optimizedRoute.estimatedTime,
            totalEstimatedCost: match.estimatedPrice,
            optimizedRoute: match.optimizedRoute,
          })),
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

// تحديث موقع السائق
router.post("/driver/:driverId/location", async (req, res) => {
  try {
    const { driverId } = req.params;
    const { location, tripId } = req.body;

    // التأكد من وجود tripId وإرسال التحديثات لجميع الركاب
    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required in the request body.",
      });
    }

    const success = await locationService.updateDriverLocation(
      driverId,
      tripId,
      location
    );

    if (success) {
      res.json({ success: true, message: "Driver location updated." });
    } else {
      res
        .status(500)
        .json({ success: false, message: "Failed to update driver location." });
    }
  } catch (error) {
    console.error("خطأ في تحديث موقع السائق:", error);
    res.status(500).json({ error: error.message });
  }
});

// تحديث حالة الرحلة (Trip)
router.put(
  "/:tripId/status",
  [
    body("status")
      .isIn(["pending", "in_progress", "completed", "cancelled"])
      .withMessage("Invalid trip status"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { status } = req.body;
      const { tripId } = req.params;

      const trip = await Trip.findById(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      const oldStatus = trip.status; // احتفظ بالحالة القديمة للمقارنة

      trip.status = status;

      // منطق بدء/إيقاف تتبع الموقع
      if (status === "in_progress" && oldStatus !== "in_progress") {
        // ابدأ تتبع الموقع إذا كانت الرحلة قد بدأت للتو
        // يجب أن نمرر driverId و tripId من كائن الرحلة
        if (trip.driver) {
          const intervalId = locationService.startLocationTracking(
            trip.driver.toString(),
            trip._id.toString()
          );
          trip.locationTrackingIntervalId = intervalId; // تخزين الـ intervalId في الرحلة
        } else {
          console.warn(
            "Cannot start location tracking: Driver not found for this trip."
          );
        }
      } else if (
        (status === "completed" || status === "cancelled") &&
        oldStatus === "in_progress"
      ) {
        // أوقف تتبع الموقع إذا انتهت الرحلة أو ألغيت
        if (trip.locationTrackingIntervalId) {
          locationService.stopLocationTracking(trip.locationTrackingIntervalId);
          trip.locationTrackingIntervalId = undefined; // إزالة الـ intervalId
        }
      }

      await trip.save();

      res.json({ message: "Trip status updated successfully" });
    } catch (error) {
      console.error("Error updating trip status:", error);
      res.status(500).json({ message: "Error updating trip status" });
    }
  }
);

module.exports = router;

