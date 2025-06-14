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

      // إذا لم توجد مطابقات، أرجع مصفوفة فارغة
      if (!rankedMatches || rankedMatches.length === 0) {
        return [];
      }

      // إنشاء اقتراح مطابقة واحد (للسيناريو الحالي)
      const driver = await this.findNearestDriver(rideRequest);
      const estimatedArrival = await this.calculateEstimatedArrival(
        driver.currentLocation,
        rideRequest.pickupLocation
      );
      const estimatedPrice = this.calculateEstimatedPrice(rideRequest, rankedMatches[0]);

      const pickupCoords = rideRequest.pickupLocation.coordinates;
      let dropoffCoords = rideRequest.dropoffLocation.coordinates;

      // إذا كانت الإحداثيات متطابقة، عدل نقطة الوصول قليلاً
      if (pickupCoords[0] === dropoffCoords[0] && pickupCoords[1] === dropoffCoords[1]) {
        dropoffCoords = [pickupCoords[0] + 0.0005, pickupCoords[1] + 0.0005];
      }

      const optimizedRoute = {
        type: 'LineString',
        coordinates: [pickupCoords, dropoffCoords],
        estimatedTime: 15,
        trafficImpact: 0.2,
        totalDistance: 5
      };

      const matchSuggestion = new RideMatchSuggestion({
        rideRequestId: rideRequest._id,
        suggestedDriverId: driver._id,
        status: 'pending',
        currentLocation: {
          type: 'Point',
          coordinates: [
            Number(driver.currentLocation.coordinates[0]),
            Number(driver.currentLocation.coordinates[1])
          ]
        },
        estimatedArrival: estimatedArrival,
        estimatedPrice: estimatedPrice,
        expiresAt: new Date(Date.now() + 3600000), // تنتهي بعد ساعة
        optimizedRoute: optimizedRoute
      });

      // أرجع دائماً مصفوفة (حتى لو كانت مطابقة واحدة فقط)
      return [matchSuggestion];
    } catch (error) {
      console.error("خطأ في العثور على المطابقات المثالية:", error);
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
    // تحسين البحث عن السائقين القريبين باستخدام GeoJSON
    const nearbyDrivers = await Driver.find({
      currentLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: rideRequest.pickupLocation.coordinates,
          },
          $maxDistance: 5000, // 5 كم
        },
      },
      status: "available",
    }).limit(5);

    // طباعة تفصيلية للإحداثيات
    console.log("تفاصيل الإحداثيات:");
    console.log("نوع pickupLocation:", typeof rideRequest.pickupLocation);
    console.log("قيمة pickupLocation:", rideRequest.pickupLocation);
    console.log(
      "نوع coordinates:",
      typeof rideRequest.pickupLocation.coordinates
    );
    console.log("قيمة coordinates:", rideRequest.pickupLocation.coordinates);

    // إذا لم يتم العثور على سائق، قم بإنشاء سائق افتراضي للاختبار
    if (nearbyDrivers.length === 0) {
      // تأكد أن الإحداثيات عبارة عن مصفوفة أرقام فقط
      const coords = Array.isArray(rideRequest.pickupLocation.coordinates[0])
        ? rideRequest.pickupLocation.coordinates[0]
        : rideRequest.pickupLocation.coordinates;
      return {
        _id: new mongoose.Types.ObjectId(),
        name: "Test Driver",
        rating: 4.5,
        currentLocation: {
          type: "Point",
          coordinates: coords,
        },
      };
    }

    return nearbyDrivers[0];
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

  // تحديث موقع السائق في الوقت الفعلي
  async updateDriverLocation(driverId, location) {
    try {
      const driver = await Driver.findById(driverId);
      if (!driver) {
        throw new Error("السائق غير موجود");
      }

      // تحديث موقع السائق
      driver.currentLocation = {
        type: "Point",
        coordinates: [location.longitude, location.latitude],
      };
      await driver.save();

      // إرسال تحديث الموقع لجميع الركاب المرتبطين
      const activeMatches = await RideMatchSuggestion.find({
        suggestedDriverId: driverId,
        status: "active",
      }).populate("rideRequestId");

      for (const match of activeMatches) {
        const riderId = match.rideRequestId.riderId;
        const estimatedArrival = await this.calculateEstimatedArrival(
          driver.currentLocation,
          match.rideRequestId.pickupLocation
        );

        // إرسال تحديث الموقع عبر Socket.IO
        global.io.to(`rider_${riderId}`).emit("driverLocationUpdate", {
          driverId,
          location: driver.currentLocation,
          estimatedArrival,
        });
      }

      return driver;
    } catch (error) {
      console.error("خطأ في تحديث موقع السائق:", error);
      throw error;
    }
  }

  // تحديث حالة الرحلة
  async updateRideStatus(rideId, status, location = null) {
    try {
      const ride = await RideMatchSuggestion.findById(rideId);
      if (!ride) {
        throw new Error("الرحلة غير موجودة");
      }

      ride.status = status;
      if (location) {
        ride.currentLocation = {
          type: "Point",
          coordinates: [location.longitude, location.latitude],
        };
      }
      await ride.save();

      // إعادة تحميل الرحلة مع currentLocation
      const updatedRide = await RideMatchSuggestion.findById(rideId);

      // إرسال تحديث الحالة لجميع الأطراف المعنية
      const rideRequest = await RideRequest.findById(updatedRide.rideRequestId);
      const driver = await Driver.findById(updatedRide.suggestedDriverId);

      // إرسال تحديث للسائق
      if (driver && global.io) {
        global.io.to(`driver_${driver._id}`).emit("rideStatusUpdate", {
          rideId,
          status,
          location: updatedRide.currentLocation,
          estimatedArrival: updatedRide.estimatedArrival,
        });
      }

      // إرسال تحديث للراكب
      if (rideRequest && global.io) {
        global.io.to(`rider_${rideRequest.riderId}`).emit("rideStatusUpdate", {
          rideId,
          status,
          location: updatedRide.currentLocation,
          estimatedArrival: updatedRide.estimatedArrival,
        });
      }

      return updatedRide;
    } catch (error) {
      console.error("خطأ في تحديث حالة الرحلة:", error);
      throw error;
    }
  }

  async calculateEstimatedArrival(driverLocation, pickupLocation) {
    try {
      // حساب المسافة بين موقع السائق ونقطة الانطلاق
      const distance = this.calculateDistance(
        driverLocation.coordinates,
        pickupLocation.coordinates
      );

      // متوسط سرعة السائق (كم/ساعة)
      const averageSpeed = 30;

      // حساب الوقت المقدر بالدقائق
      const estimatedTimeInMinutes = (distance / averageSpeed) * 60;

      // إضافة وقت إضافي للازدحام المروري
      const trafficMultiplier = this.calculateTrafficMultiplier();
      const totalEstimatedTime = estimatedTimeInMinutes * trafficMultiplier;

      // إضافة الوقت المقدر إلى الوقت الحالي
      const estimatedArrival = new Date();
      estimatedArrival.setMinutes(estimatedArrival.getMinutes() + totalEstimatedTime);

      return estimatedArrival;
    } catch (error) {
      console.error('خطأ في حساب وقت الوصول المقدر:', error);
      throw error;
    }
  }

  calculateTrafficMultiplier() {
    const hour = new Date().getHours();
    
    // أوقات الذروة الصباحية (7-9 صباحاً)
    if (hour >= 7 && hour <= 9) {
      return 1.5;
    }
    
    // أوقات الذروة المسائية (4-7 مساءً)
    if (hour >= 16 && hour <= 19) {
      return 1.8;
    }
    
    // الأوقات العادية
    return 1.2;
  }

  calculateDistance(point1, point2) {
    try {
      // استخدام صيغة هافرساين لحساب المسافة بين نقطتين على سطح الكرة الأرضية
      const R = 6371; // نصف قطر الأرض بالكيلومترات
      const dLat = this.toRad(point2[1] - point1[1]);
      const dLon = this.toRad(point2[0] - point1[0]);
      const lat1 = this.toRad(point1[1]);
      const lat2 = this.toRad(point2[1]);

      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      return distance;
    } catch (error) {
      console.error('خطأ في حساب المسافة:', error);
      throw error;
    }
  }

  toRad(value) {
    return value * Math.PI / 180;
  }
}

module.exports = new AIMatchingService();
