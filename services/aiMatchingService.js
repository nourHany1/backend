const RideRequest = require("../models/RideRequest");
const Driver = require("../models/Driver");
const RideMatchSuggestion = require("../models/RideMatchSuggestion");

class AIMatchingService {
  async findOptimalMatches(rideRequest) {
    try {
      // Get all available drivers
      const availableDrivers = await Driver.find({
        status: "available",
        currentLocation: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: rideRequest.pickupLocation.coordinates,
            },
            $maxDistance: 5000, // 5km radius
          },
        },
      });

      // Calculate match scores for each driver
      const matchScores = await Promise.all(
        availableDrivers.map(async (driver) => {
          const score = await this.calculateMatchScore(rideRequest, driver);
          return { driver, score };
        })
      );

      // Sort by score and get top matches
      const topMatches = matchScores
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      // Create match suggestions
      const suggestions = await Promise.all(
        topMatches.map(async ({ driver, score }) => {
          const suggestion = new RideMatchSuggestion({
            rideRequestId: rideRequest._id,
            suggestedDriverId: driver._id,
            matchScore: score,
            status: "pending",
            potentialRiders: [
              {
                riderId: rideRequest.riderId,
                status: "pending",
              },
            ],
          });
          await suggestion.save();
          return suggestion;
        })
      );

      return suggestions;
    } catch (error) {
      console.error("Error in AI matching:", error);
      throw error;
    }
  }

  async calculateMatchScore(rideRequest, driver) {
    let score = 0;

    // Distance score (40% weight)
    const distanceScore = this.calculateDistanceScore(
      rideRequest.pickupLocation,
      driver.currentLocation
    );
    score += distanceScore * 0.4;

    // Driver rating score (30% weight)
    const ratingScore = driver.rating / 5;
    score += ratingScore * 0.3;

    // Driver experience score (20% weight)
    const experienceScore = Math.min(driver.tripsCompleted / 100, 1);
    score += experienceScore * 0.2;

    // Vehicle type match score (10% weight)
    const vehicleMatchScore = this.calculateVehicleMatchScore(
      rideRequest,
      driver
    );
    score += vehicleMatchScore * 0.1;

    return score;
  }

  calculateDistanceScore(pickupLocation, driverLocation) {
    // Implement distance calculation logic
    // Return score between 0 and 1
    return 0.8; // Placeholder
  }

  calculateVehicleMatchScore(rideRequest, driver) {
    // Implement vehicle type matching logic
    // Return score between 0 and 1
    return 0.9; // Placeholder
  }
}

module.exports = new AIMatchingService();
