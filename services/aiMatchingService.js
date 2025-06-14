const RideRequest = require("../models/RideRequest");
const Driver = require("../models/Driver");
const RideMatchSuggestion = require("../models/RideMatchSuggestion");
const User = require("../models/User");
const mongoose = require("mongoose");

class AIMatchingService {
  async findOptimalMatches(rideRequest) {
    try {
      // تحليل المسار الأولي
      const initialRoute = await this.analyzeInitialRoute(rideRequest);

      // البحث عن راكبين متوافقين
      const compatibleRiders = await this.findCompatibleRiders(
        initialRoute,
        rideRequest
      );

      // حساب تأثير المسار
      const routeImpact = await this.calculateRouteImpact(
        compatibleRiders,
        initialRoute
      );

      // ترتيب المطابقات
      const rankedMatches = await this.rankMatches(routeImpact, rideRequest);

      return rankedMatches;
    } catch (error) {
      console.error("AI Matching Error:", error);
      throw error;
    }
  }

  async analyzeInitialRoute(rideRequest) {
    // تحليل المسار الأولي بناءً على نقاط الالتقاط والتوصيل
    return {
      type: "LineString",
      coordinates: [
        rideRequest.pickupLocation.coordinates,
        rideRequest.dropoffLocation.coordinates,
      ],
      estimatedTime: 15, // دقائق
      totalDistance: 5, // كيلومترات
      trafficImpact: 0.2, // تأثير حركة المرور (0-1)
    };
  }

  async findCompatibleRiders(initialRoute, currentRequest) {
    // البحث عن راكبين في نفس المنطقة مع تفضيلات متوافقة
    const compatibleRiders = await RideRequest.find({
      _id: { $ne: currentRequest._id },
      status: "pending",
      "preferences.allowSharing": true,
      pickupLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: currentRequest.pickupLocation.coordinates,
          },
          $maxDistance: 2000, // 2 كيلومتر
        },
      },
    });

    return compatibleRiders.filter((rider) =>
      this.isCompatible(currentRequest, rider)
    );
  }

  isCompatible(rider1, rider2) {
    // التحقق من توافق التفضيلات
    if (!rider1.preferences.allowSharing || !rider2.preferences.allowSharing) {
      return false;
    }

    // التحقق من تفضيلات الجنس
    if (
      rider1.preferences.genderPreference !== "any" &&
      rider1.preferences.genderPreference !== rider2.gender
    ) {
      return false;
    }

    if (
      rider2.preferences.genderPreference !== "any" &&
      rider2.preferences.genderPreference !== rider1.gender
    ) {
      return false;
    }

    return true;
  }

  async calculateRouteImpact(compatibleRiders, initialRoute) {
    const routeImpact = [];

    for (const rider of compatibleRiders) {
      const impact = {
        riderId: rider._id,
        estimatedDelayMinutes: this.calculateAdditionalTime(
          rider,
          initialRoute
        ),
        compatibilityScore: this.calculateCompatibilityScore(rider),
        routeImpact: this.calculateRouteImpactScore(rider, initialRoute),
        pickupOrder: 1,
        dropoffOrder: 2,
      };
      routeImpact.push(impact);
    }

    return routeImpact;
  }

  calculateAdditionalTime(rider, initialRoute) {
    // حساب الوقت الإضافي بناءً على المسافة والازدحام
    return Math.round(
      (initialRoute.estimatedTime * (1 + initialRoute.trafficImpact)) / 2
    );
  }

  calculateCompatibilityScore(rider) {
    // حساب درجة التوافق بناءً على التقييم والتفضيلات
    return (rider.rating || 3) / 5;
  }

  calculateRouteImpactScore(rider, initialRoute) {
    // حساب تأثير المسار بناءً على المسافة والوقت
    return 1 - initialRoute.trafficImpact;
  }

  async rankMatches(routeImpact, currentRequest) {
    // ترتيب المطابقات حسب الأفضلية
    const sortedMatches = [...routeImpact].sort((a, b) => {
      const scoreA = this.calculateMatchScore(a);
      const scoreB = this.calculateMatchScore(b);
      return scoreB - scoreA;
    });

    // إنشاء اقتراحات المطابقة
    const matches = await Promise.all(
      sortedMatches.slice(0, 5).map(async (match) => {
        const driver = await this.findNearestDriver(currentRequest);
        return new RideMatchSuggestion({
          rideRequestId: currentRequest._id,
          suggestedDriverId: driver._id,
          potentialRiders: [
            {
              riderId: match.riderId,
              estimatedDelayMinutes: match.estimatedDelayMinutes,
              compatibilityScore: match.compatibilityScore,
              routeImpact: match.routeImpact,
              pickupOrder: match.pickupOrder,
              dropoffOrder: match.dropoffOrder,
            },
          ],
          optimizedRoute: {
            type: "LineString",
            coordinates: [
              [
                Number(currentRequest.pickupLocation.coordinates[0]) || 0,
                Number(currentRequest.pickupLocation.coordinates[1]) || 0,
              ],
              [
                Number(currentRequest.dropoffLocation.coordinates[0]) || 0,
                Number(currentRequest.dropoffLocation.coordinates[1]) || 0,
              ],
            ],
            estimatedTime: 15,
            trafficImpact: 0.2,
            totalDistance: 5,
          },
          estimatedPrice: this.calculateEstimatedPrice(currentRequest, match),
          pricePerRider: [
            {
              riderId: match.riderId,
              amount: this.calculateRiderPrice(currentRequest, match),
            },
          ],
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // تنتهي بعد 15 دقيقة
        });
      })
    );

    return matches;
  }

  calculateMatchScore(match) {
    // حساب درجة المطابقة بناءً على عدة عوامل
    return (
      match.compatibilityScore * 0.4 +
      (1 - match.routeImpact) * 0.3 +
      (1 - match.estimatedDelayMinutes / 30) * 0.3
    );
  }

  async findNearestDriver(rideRequest) {
    // البحث عن أقرب سائق متاح
    const driver = await Driver.findOne({
      status: "available",
      currentLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: rideRequest.pickupLocation.coordinates,
          },
          $maxDistance: 5000, // 5 كيلومترات
        },
      },
    });

    // إذا لم يتم العثور على سائق، قم بإنشاء سائق افتراضي للاختبار
    if (!driver) {
      return {
        _id: new mongoose.Types.ObjectId(),
        name: "Test Driver",
        rating: 4.5,
        currentLocation: {
          type: "Point",
          coordinates: rideRequest.pickupLocation.coordinates,
        },
      };
    }

    return driver;
  }

  calculateEstimatedPrice(rideRequest, match) {
    // حساب السعر المقدر بناءً على المسافة والوقت والطلب
    const basePrice = 50; // السعر الأساسي
    const distanceMultiplier = 1.5; // مضاعف المسافة
    const timeMultiplier = 1.2; // مضاعف الوقت
    const demandMultiplier = this.calculateDemandMultiplier(); // مضاعف الطلب

    return Math.round(
      basePrice * distanceMultiplier * timeMultiplier * demandMultiplier
    );
  }

  calculateRiderPrice(rideRequest, match) {
    // حساب سعر كل راكب بناءً على المسافة والوقت
    const basePrice = this.calculateEstimatedPrice(rideRequest, match);
    return Math.round(basePrice * 0.8); // خصم 20% للمشاركة
  }

  calculateDemandMultiplier() {
    // حساب مضاعف الطلب بناءً على الوقت الحالي
    const hour = new Date().getHours();
    if (hour >= 7 && hour <= 9) {
      return 1.5; // وقت الذروة الصباحي
    } else if (hour >= 16 && hour <= 19) {
      return 1.8; // وقت الذروة المسائي
    }
    return 1.2; // وقت عادي
  }
}

module.exports = new AIMatchingService();
