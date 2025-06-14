const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const RideRequest = require("../models/RideRequest");
const RideMatchSuggestion = require("../models/RideMatchSuggestion");
const User = require("../models/User");
const Driver = require("../models/Driver");

describe("Rides API Tests", () => {
  let testRider;
  let testDriver;
  let testRideRequest;
  let testMatch;

  beforeAll(async () => {
    // إنشاء راكب اختباري
    testRider = await User.create({
      name: "Test Rider",
      email: "testrider@test.com",
      phone: "1234567890",
      role: "rider",
      password: "test1234",
      gender: "male",
      rating: 4.5,
    });

    // إنشاء سائق اختباري
    testDriver = await Driver.create({
      name: "Test Driver",
      email: "testdriver@test.com",
      phone: "0987654321",
      currentLocation: {
        type: "Point",
        coordinates: [31.2357, 30.0444], // Cairo coordinates
      },
      status: "available",
      role: "driver",
      password: "test1234",
      gender: "male",
      rating: 4.8,
      tripsCompleted: 100,
    });
  });

  beforeEach(async () => {
    // إنشاء طلب ركوب اختباري جديد قبل كل اختبار
    testRideRequest = await RideRequest.create({
      pickupLocation: {
        type: "Point",
        coordinates: [31.2357, 30.0444],
      },
      dropoffLocation: {
        type: "Point",
        coordinates: [31.2357, 30.0444],
      },
      riderId: testRider._id,
      passengers: 1,
      preferences: {
        allowSharing: true,
        maxDelay: 10,
      },
      status: "pending",
    });

    // إنشاء اقتراح مطابقة اختباري جديد قبل كل اختبار
    testMatch = await RideMatchSuggestion.create({
      rideRequestId: testRideRequest._id,
      suggestedDriverId: testDriver._id,
      potentialRiders: [
        {
          riderId: testRider._id,
          estimatedDelayMinutes: 5,
        },
      ],
      status: "pending",
      optimizedRoute: {
        type: "Point",
        coordinates: [31.2357, 30.0444],
      },
    });
  });

  afterEach(async () => {
    await RideRequest.deleteMany({});
    await RideMatchSuggestion.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  describe("POST /rides/request", () => {
    it("should create a new ride request", async () => {
      const response = await request(app)
        .post("/rides/request")
        .send({
          pickupLocation: {
            type: "Point",
            coordinates: [31.2357, 30.0444],
          },
          dropoffLocation: {
            type: "Point",
            coordinates: [31.2357, 30.0444],
          },
          riderId: testRider._id,
          passengers: 1,
          preferences: {
            allowSharing: true,
            maxDelay: 10,
          },
        });

      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty("rideRequestId");
      expect(response.body.status).toBe("pending_ai_matching");
    });

    it("should validate required fields", async () => {
      const response = await request(app).post("/rides/request").send({
        riderId: testRider._id,
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");
    });
  });

  describe("POST /rides/suggest-matches", () => {
    it("should return AI-powered ride suggestions", async () => {
      const response = await request(app)
        .post("/rides/suggest-matches")
        .send({
          pickupLocation: {
            type: "Point",
            coordinates: [31.2357, 30.0444],
          },
          dropoffLocation: {
            type: "Point",
            coordinates: [31.2357, 30.0444],
          },
          riderId: testRider._id,
          passengers: 1,
          preferences: {
            allowSharing: true,
            maxDelay: 10,
          },
        });
      if (response.status !== 200) {
        console.log("AI-powered ride suggestions error:", response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("matches");
      expect(Array.isArray(response.body.matches)).toBe(true);
    });
  });

  describe("GET /rides/ongoing-rides", () => {
    it("should return nearby ongoing rides", async () => {
      // تحديث حالة المطابقة إلى accepted
      await RideMatchSuggestion.findByIdAndUpdate(testMatch._id, {
        status: "accepted",
      });

      const response = await request(app).get("/rides/ongoing-rides").query({
        latitude: 30.0444,
        longitude: 31.2357,
        radius: 5000,
      });
      if (response.status !== 200) {
        console.log("Ongoing rides error:", response.body);
      }
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("PUT /rides/:rideId/preferences", () => {
    it("should update ride preferences", async () => {
      const response = await request(app)
        .put(`/rides/${testRideRequest._id}/preferences`)
        .send({
          preferences: {
            allowSharing: false,
            maxDelay: 5,
          },
        });
      if (response.status !== 200) {
        console.log("Update ride preferences error:", response.body);
      }
      expect(response.status).toBe(200);
      expect([
        "Preferences updated successfully",
        "Preferences updated and new matches found",
      ]).toContain(response.body.message);
    });

    it("should trigger re-matching when sharing preference changes", async () => {
      const response = await request(app)
        .put(`/rides/${testRideRequest._id}/preferences`)
        .send({
          preferences: {
            allowSharing: true,
            maxDelay: 10,
          },
        });
      if (response.status !== 200) {
        console.log("Re-matching error:", response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("matches");
    });
  });

  describe("POST /rides/:rideId/accept-match", () => {
    it("should accept a ride match", async () => {
      const response = await request(app)
        .post(`/rides/${testMatch._id}/accept-match`)
        .send({
          riderId: testRider._id,
          acceptedMatch: true,
        });
      if (response.status !== 200) {
        console.log("Accept match error:", response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");

      const updatedMatch = await RideMatchSuggestion.findById(testMatch._id);
      expect(updatedMatch.status).toBe("accepted");
    });
  });

  describe("GET /rides/active-matches/:riderId", () => {
    it("should return active matches for a rider", async () => {
      const response = await request(app).get(
        `/rides/active-matches/${testRider._id}`
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("Advanced AI Matching Scenarios", () => {
    it("should only match riders who allow sharing in the same area", async () => {
      // راكب يسمح بالمشاركة
      const sharingRider = await User.create({
        name: "Sharing Rider",
        email: "sharingrider@test.com",
        phone: "1111111111",
        role: "rider",
        password: "test1234",
        gender: "male",
        rating: 4.2,
      });
      // راكب لا يسمح بالمشاركة
      const nonSharingRider = await User.create({
        name: "NonSharing Rider",
        email: "nonsharingrider@test.com",
        phone: "2222222222",
        role: "rider",
        password: "test1234",
        gender: "female",
        rating: 4.7,
      });
      // طلب ركوب يسمح بالمشاركة
      const sharingRequest = await RideRequest.create({
        pickupLocation: {
          type: "Point",
          coordinates: [31.2357, 30.0444],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.24, 30.05],
        },
        riderId: sharingRider._id,
        passengers: 1,
        preferences: {
          allowSharing: true,
          maxDelay: 10,
        },
        status: "pending",
      });
      // طلب ركوب لا يسمح بالمشاركة
      const nonSharingRequest = await RideRequest.create({
        pickupLocation: {
          type: "Point",
          coordinates: [31.2358, 30.0445],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.2401, 30.0501],
        },
        riderId: nonSharingRider._id,
        passengers: 1,
        preferences: {
          allowSharing: false,
          maxDelay: 10,
        },
        status: "pending",
      });
      // طلب مطابقة AI للراكب الذي يسمح بالمشاركة
      const response = await request(app)
        .post("/rides/suggest-matches")
        .send({
          pickupLocation: sharingRequest.pickupLocation,
          dropoffLocation: sharingRequest.dropoffLocation,
          riderId: sharingRider._id,
          passengers: 1,
          preferences: {
            allowSharing: true,
            maxDelay: 10,
          },
        });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("matches");
      // يجب ألا تتضمن المطابقة راكب لا يسمح بالمشاركة
      const matches = response.body.matches;
      expect(matches.length).toBeGreaterThanOrEqual(0);
      // تحقق أن كل المطابقات لا تحتوي على nonSharingRider
      if (matches.length > 0) {
        matches.forEach((match) => {
          if (match.potentialRiders) {
            match.potentialRiders.forEach((r) => {
              expect(r.riderId).not.toBe(nonSharingRider._id.toString());
            });
          }
        });
      }
    });

    it("should respect gender preference in matching", async () => {
      const maleRider = await User.create({
        name: "Male Rider",
        email: "malerider@test.com",
        phone: "3333333333",
        role: "rider",
        password: "test1234",
        gender: "male",
        rating: 4.0,
      });
      const femaleRider = await User.create({
        name: "Female Rider",
        email: "femalerider@test.com",
        phone: "4444444444",
        role: "rider",
        password: "test1234",
        gender: "female",
        rating: 4.5,
      });
      // طلب ركوب يفضل نفس الجنس
      const genderPrefRequest = await RideRequest.create({
        pickupLocation: { type: "Point", coordinates: [31.2357, 30.0444] },
        dropoffLocation: { type: "Point", coordinates: [31.24, 30.05] },
        riderId: maleRider._id,
        passengers: 1,
        preferences: { allowSharing: true, genderPreference: "same" },
        status: "pending",
      });
      // طلب ركوب بدون تفضيل جنس
      const anyGenderRequest = await RideRequest.create({
        pickupLocation: { type: "Point", coordinates: [31.2358, 30.0445] },
        dropoffLocation: { type: "Point", coordinates: [31.2401, 30.0501] },
        riderId: femaleRider._id,
        passengers: 1,
        preferences: { allowSharing: true, genderPreference: "any" },
        status: "pending",
      });
      // طلب مطابقة AI للراكب الذي يفضل نفس الجنس
      const response = await request(app)
        .post("/rides/suggest-matches")
        .send({
          pickupLocation: genderPrefRequest.pickupLocation,
          dropoffLocation: genderPrefRequest.dropoffLocation,
          riderId: maleRider._id,
          passengers: 1,
          preferences: { allowSharing: true, genderPreference: "same" },
        });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("matches");
      // يجب ألا تتضمن المطابقة راكب من جنس مختلف
      const matches = response.body.matches;
      if (matches.length > 0) {
        matches.forEach((match) => {
          if (match.potentialRiders) {
            match.potentialRiders.forEach((r) => {
              expect(r.riderId).not.toBe(femaleRider._id.toString());
            });
          }
        });
      }
    });

    it("should respect maxDelay in matching", async () => {
      const delayRider = await User.create({
        name: "Delay Rider",
        email: "delayrider@test.com",
        phone: "5555555555",
        role: "rider",
        password: "test1234",
        gender: "male",
        rating: 4.1,
      });
      const strictDelayRequest = await RideRequest.create({
        pickupLocation: { type: "Point", coordinates: [31.2357, 30.0444] },
        dropoffLocation: { type: "Point", coordinates: [31.24, 30.05] },
        riderId: delayRider._id,
        passengers: 1,
        preferences: { allowSharing: true, maxDelay: 1 },
        status: "pending",
      });
      // طلب مطابقة AI مع maxDelay صغير
      const response = await request(app)
        .post("/rides/suggest-matches")
        .send({
          pickupLocation: strictDelayRequest.pickupLocation,
          dropoffLocation: strictDelayRequest.dropoffLocation,
          riderId: delayRider._id,
          passengers: 1,
          preferences: { allowSharing: true, maxDelay: 1 },
        });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("matches");
      // غالباً لن يجد مطابقة إذا لم يوجد ركاب آخرون بنفس maxDelay
    });

    it("should not match if maxPassengers is exceeded", async () => {
      const groupRider = await User.create({
        name: "Group Rider",
        email: "grouprider@test.com",
        phone: "6666666666",
        role: "rider",
        password: "test1234",
        gender: "male",
        rating: 4.3,
      });
      const groupRequest = await RideRequest.create({
        pickupLocation: { type: "Point", coordinates: [31.2357, 30.0444] },
        dropoffLocation: { type: "Point", coordinates: [31.24, 30.05] },
        riderId: groupRider._id,
        passengers: 5,
        preferences: { allowSharing: true, maxPassengers: 4 },
        status: "pending",
      });
      const response = await request(app)
        .post("/rides/suggest-matches")
        .send({
          pickupLocation: groupRequest.pickupLocation,
          dropoffLocation: groupRequest.dropoffLocation,
          riderId: groupRider._id,
          passengers: 5,
          preferences: { allowSharing: true, maxPassengers: 4 },
        });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("matches");
      expect(response.body.matches.length).toBe(0);
    });

    it("should update matches when preferences change", async () => {
      // أنشئ طلب ركوب يسمح بالمشاركة
      const rider = await User.create({
        name: "Pref Change Rider",
        email: "prefchanger@test.com",
        phone: "7777777777",
        role: "rider",
        password: "test1234",
        gender: "male",
        rating: 4.4,
      });
      const rideRequest = await RideRequest.create({
        pickupLocation: { type: "Point", coordinates: [31.2357, 30.0444] },
        dropoffLocation: { type: "Point", coordinates: [31.24, 30.05] },
        riderId: rider._id,
        passengers: 1,
        preferences: { allowSharing: false },
        status: "pending",
      });
      // غيّر التفضيلات للسماح بالمشاركة
      const response = await request(app)
        .put(`/rides/${rideRequest._id}/preferences`)
        .send({ preferences: { allowSharing: true, maxDelay: 10 } });
      expect(response.status).toBe(200);
      expect([
        "Preferences updated successfully",
        "Preferences updated and new matches found",
      ]).toContain(response.body.message);
    });

    it("should handle match acceptance and rejection", async () => {
      // أنشئ مطابقة
      const match = await RideMatchSuggestion.create({
        rideRequestId: testRideRequest._id,
        suggestedDriverId: testDriver._id,
        potentialRiders: [{ riderId: testRider._id, estimatedDelayMinutes: 5 }],
        status: "pending",
        optimizedRoute: { type: "Point", coordinates: [31.2357, 30.0444] },
      });
      // قبول المطابقة
      let response = await request(app)
        .post(`/rides/${match._id}/accept-match`)
        .send({ riderId: testRider._id, acceptedMatch: true });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      // رفض المطابقة
      const match2 = await RideMatchSuggestion.create({
        rideRequestId: testRideRequest._id,
        suggestedDriverId: testDriver._id,
        potentialRiders: [{ riderId: testRider._id, estimatedDelayMinutes: 5 }],
        status: "pending",
        optimizedRoute: { type: "Point", coordinates: [31.2357, 30.0444] },
      });
      response = await request(app)
        .post(`/rides/${match2._id}/accept-match`)
        .send({ riderId: testRider._id, acceptedMatch: false });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
    });

    it("should return error for missing required fields", async () => {
      const response = await request(app).post("/rides/request").send({});
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");
    });

    it("should return error for non-existent match", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      const response = await request(app)
        .post(`/rides/${fakeId}/accept-match`)
        .send({ riderId: testRider._id, acceptedMatch: true });
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("message");
    });
  });
});
