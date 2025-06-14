const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Driver = require("../models/Driver");
const RideRequest = require("../models/RideRequest");
const RideMatchSuggestion = require("../models/RideMatchSuggestion");
const aiMatchingService = require("../services/aiMatchingService");

describe("AI Matching Service Tests", () => {
  let testRider1, testRider2, testDriver;

  beforeAll(async () => {
    // إنشاء راكبين اختباريين
    testRider1 = await User.create({
      name: "Test Rider 1",
      email: "testrider1@test.com",
      phone: "1111111111",
      role: "rider",
      password: "test1234",
      gender: "male",
      rating: 4.5,
    });

    testRider2 = await User.create({
      name: "Test Rider 2",
      email: "testrider2@test.com",
      phone: "2222222222",
      role: "rider",
      password: "test1234",
      gender: "female",
      rating: 4.7,
    });

    // إنشاء سائق اختباري
    testDriver = await Driver.create({
      name: "Test Driver",
      email: "testdriver@test.com",
      phone: "3333333333",
      role: "driver",
      password: "test1234",
      gender: "male",
      rating: 4.8,
      currentLocation: {
        type: "Point",
        coordinates: [31.2357, 30.0444],
      },
      status: "available",
    });
  });

  afterEach(async () => {
    await RideRequest.deleteMany({});
    await RideMatchSuggestion.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Driver.deleteMany({});
    await mongoose.connection.close();
  });

  describe("Route Analysis", () => {
    it("should analyze initial route correctly", async () => {
      const rideRequest = await RideRequest.create({
        pickupLocation: {
          type: "Point",
          coordinates: [31.2357, 30.0444],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.24, 30.05],
        },
        riderId: testRider1._id,
        passengers: 1,
        preferences: {
          allowSharing: true,
          genderPreference: "any",
          maxDelay: 10,
        },
        status: "pending",
      });

      const initialRoute = await aiMatchingService.analyzeInitialRoute(
        rideRequest
      );
      expect(initialRoute).toHaveProperty("type", "LineString");
      expect(initialRoute).toHaveProperty("coordinates");
      expect(initialRoute).toHaveProperty("estimatedTime");
      expect(initialRoute).toHaveProperty("totalDistance");
      expect(initialRoute).toHaveProperty("trafficImpact");
    });
  });

  describe("Rider Compatibility", () => {
    it("should find compatible riders based on preferences", async () => {
      // إنشاء طلب ركوب أول
      const rideRequest1 = await RideRequest.create({
        pickupLocation: {
          type: "Point",
          coordinates: [31.2357, 30.0444],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.24, 30.05],
        },
        riderId: testRider1._id,
        passengers: 1,
        preferences: {
          allowSharing: true,
          genderPreference: "any",
          maxDelay: 10,
        },
        status: "pending",
      });

      // إنشاء طلب ركوب ثانٍ متوافق
      const rideRequest2 = await RideRequest.create({
        pickupLocation: {
          type: "Point",
          coordinates: [31.2358, 30.0445],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.2401, 30.0501],
        },
        riderId: testRider2._id,
        passengers: 1,
        preferences: {
          allowSharing: true,
          genderPreference: "any",
          maxDelay: 10,
        },
        status: "pending",
      });

      const initialRoute = await aiMatchingService.analyzeInitialRoute(
        rideRequest1
      );
      const compatibleRiders = await aiMatchingService.findCompatibleRiders(
        initialRoute,
        rideRequest1
      );

      expect(compatibleRiders).toHaveLength(1);
      expect(compatibleRiders[0]._id.toString()).toBe(
        rideRequest2._id.toString()
      );
    });

    it("should not match riders with incompatible preferences", async () => {
      // إنشاء طلب ركوب يرفض المشاركة
      const rideRequest1 = await RideRequest.create({
        pickupLocation: {
          type: "Point",
          coordinates: [31.2357, 30.0444],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.24, 30.05],
        },
        riderId: testRider1._id,
        passengers: 1,
        preferences: {
          allowSharing: false,
          genderPreference: "any",
          maxDelay: 10,
        },
        status: "pending",
      });

      // إنشاء طلب ركوب ثانٍ
      const rideRequest2 = await RideRequest.create({
        pickupLocation: {
          type: "Point",
          coordinates: [31.2358, 30.0445],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.2401, 30.0501],
        },
        riderId: testRider2._id,
        passengers: 1,
        preferences: {
          allowSharing: true,
          genderPreference: "any",
          maxDelay: 10,
        },
        status: "pending",
      });

      const initialRoute = await aiMatchingService.analyzeInitialRoute(
        rideRequest1
      );
      const compatibleRiders = await aiMatchingService.findCompatibleRiders(
        initialRoute,
        rideRequest1
      );

      expect(compatibleRiders).toHaveLength(0);
    });
  });

  describe("Match Ranking", () => {
    it("should rank matches based on multiple factors", async () => {
      // إنشاء طلب ركوب
      const rideRequest = await RideRequest.create({
        pickupLocation: {
          type: "Point",
          coordinates: [31.2357, 30.0444],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.24, 30.05],
        },
        riderId: testRider1._id,
        passengers: 1,
        preferences: {
          allowSharing: true,
          genderPreference: "any",
          maxDelay: 10,
        },
        status: "pending",
      });

      const matches = await aiMatchingService.findOptimalMatches(rideRequest);
      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBeLessThanOrEqual(5); // يجب أن لا يتجاوز 5 مطابقات
    });
  });
});
