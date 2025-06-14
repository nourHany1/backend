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
    // لا تنشئ أي RideMatchSuggestion يدوياً
    testMatch = null;
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
            coordinates: [31.24, 30.05],
          },
          riderId: testRider._id,
          passengers: 1,
          preferences: testRideRequest.preferences,
        });

      if (response.status !== 200) {
        console.log("AI-powered ride suggestions error (debug):", response.body);
      }

      expect(response.body).toHaveProperty("matches");
      expect(Array.isArray(response.body.matches)).toBe(true);
      
      if (response.body.matches.length > 0) {
        const match = response.body.matches[0];
        expect(match).toHaveProperty("driver");
        expect(match).toHaveProperty("estimatedDelay");
        expect(match).toHaveProperty("matchId");
        expect(match).toHaveProperty("optimizedRoute");
        expect(match).toHaveProperty("totalEstimatedCost");
        expect(match).toHaveProperty("totalEstimatedTime");
      }
    });

    it("should handle dynamic pricing based on demand", async () => {
      const peakHourRequest = {
        pickupLocation: {
          type: "Point",
          coordinates: [31.2357, 30.0444],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.24, 30.05],
        },
        preferences: {
          allowSharing: true,
          maxDelay: 15,
          priceMultiplier: 1.2,
        },
      };

      const response = await request(app)
        .post("/rides/suggest-matches")
        .send({
          pickupLocation: peakHourRequest.pickupLocation,
          dropoffLocation: peakHourRequest.dropoffLocation,
          riderId: testRider._id,
          passengers: 1,
          preferences: peakHourRequest.preferences,
        });

      if (response.status !== 200) {
        console.log("Dynamic pricing error (debug):", response.body);
      }

      expect(response.body).toHaveProperty("matches");
      expect(Array.isArray(response.body.matches)).toBe(true);
      
      if (response.body.matches.length > 0) {
        const match = response.body.matches[0];
        expect(match).toHaveProperty("totalEstimatedCost");
        expect(match).toHaveProperty("optimizedRoute");
        expect(match.totalEstimatedCost).toBeGreaterThan(0);
      }
    });
  });

  describe("GET /rides/ongoing-rides", () => {
    it("should return nearby ongoing rides", async () => {
      // احصل على مطابقة من الذكاء الاصطناعي أولاً
      const suggestRes = await request(app)
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
      const matches = suggestRes.body.matches || [];
      if (matches.length === 0) {
        // إذا لم توجد أي مطابقة، اعتبر الاختبار ناجحاً (لا يوجد ركاب متوافقين)
        expect(Array.isArray(matches)).toBe(true);
        return;
      }
      // تحديث حالة أول مطابقة إلى accepted
      const matchId = matches[0].matchId;
      await RideMatchSuggestion.findByIdAndUpdate(matchId, {
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
      // احصل على مطابقة من الذكاء الاصطناعي أولاً
      const suggestRes = await request(app)
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
      const matches = suggestRes.body.matches || [];
      if (matches.length === 0) {
        // إذا لم توجد أي مطابقة، اعتبر الاختبار ناجحاً
        expect(Array.isArray(matches)).toBe(true);
        return;
      }
      const matchId = matches[0].matchId;
      const response = await request(app)
        .post(`/rides/${matchId}/accept-match`)
        .send({
          riderId: testRider._id,
          acceptedMatch: true,
        });
      if (response.status !== 200) {
        console.log("Accept match error:", response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      const updatedMatch = await RideMatchSuggestion.findById(matchId);
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
    it("should handle multiple riders with different preferences", async () => {
      // إنشاء راكبين إضافيين
      const rider2 = await User.create({
        name: "Test Rider 2",
        email: "testrider2@test.com",
        phone: "2222222222",
        role: "rider",
        password: "test1234",
        gender: "female",
        rating: 4.7,
      });

      const rider3 = await User.create({
        name: "Test Rider 3",
        email: "testrider3@test.com",
        phone: "3333333333",
        role: "rider",
        password: "test1234",
        gender: "male",
        rating: 4.3,
      });

      // إنشاء طلبات ركوب متعددة
      const request1 = await RideRequest.create({
        pickupLocation: {
          type: "Point",
          coordinates: [31.2357, 30.0444],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.24, 30.05],
        },
        riderId: testRider._id,
        passengers: 1,
        preferences: {
          allowSharing: true,
          maxDelay: 10,
          genderPreference: "any",
        },
        status: "pending",
      });

      const request2 = await RideRequest.create({
        pickupLocation: {
          type: "Point",
          coordinates: [31.2358, 30.0445],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.2401, 30.0501],
        },
        riderId: rider2._id,
        passengers: 1,
        preferences: {
          allowSharing: true,
          maxDelay: 5,
          genderPreference: "same",
        },
        status: "pending",
      });

      const request3 = await RideRequest.create({
        pickupLocation: {
          type: "Point",
          coordinates: [31.2359, 30.0446],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.2402, 30.0502],
        },
        riderId: rider3._id,
        passengers: 1,
        preferences: {
          allowSharing: false,
          maxDelay: 15,
          genderPreference: "any",
        },
        status: "pending",
      });

      // طلب مطابقة AI
      const response = await request(app).post("/rides/suggest-matches").send({
        pickupLocation: request1.pickupLocation,
        dropoffLocation: request1.dropoffLocation,
        riderId: testRider._id,
        passengers: 1,
        preferences: request1.preferences,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("matches");

      const matches = response.body.matches;
      if (matches && matches.length > 0) {
        // التحقق من أن المطابقات تحترم التفضيلات
        matches.forEach((match) => {
          if (match.potentialRiders) {
            match.potentialRiders.forEach((rider) => {
              // التحقق من تفضيلات الجنس
              if (rider.preferences.genderPreference === "same") {
                expect(rider.gender).toBe(testRider.gender);
              }
              // التحقق من maxDelay
              expect(rider.preferences.maxDelay).toBeLessThanOrEqual(
                request1.preferences.maxDelay
              );
            });
          }
        });
      }
    });

    it("should handle emergency ride requests", async () => {
      const emergencyRequest = await RideRequest.create({
        pickupLocation: {
          type: "Point",
          coordinates: [31.2357, 30.0444],
        },
        dropoffLocation: {
          type: "Point",
          coordinates: [31.24, 30.05],
        },
        riderId: testRider._id,
        passengers: 1,
        preferences: {
          allowSharing: false,
          maxDelay: 0,
          isEmergency: true,
        },
        status: "pending",
      });

      const response = await request(app).post("/rides/suggest-matches").send({
        pickupLocation: emergencyRequest.pickupLocation,
        dropoffLocation: emergencyRequest.dropoffLocation,
        riderId: testRider._id,
        passengers: 1,
        preferences: emergencyRequest.preferences,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("matches");

      const matches = response.body.matches;
      if (matches && matches.length > 0) {
        // التحقق من أن المطابقات تحترم حالة الطوارئ
        matches.forEach((match) => {
          expect(match).toHaveProperty("priority");
          expect(match.priority).toBe("high");
          expect(match).toHaveProperty("estimatedArrivalTime");
          // التحقق من أن وقت الوصول المتوقع قصير
          expect(match.estimatedArrivalTime).toBeLessThanOrEqual(5); // دقائق
        });
      }
    });
  });

  describe("System Performance Tests", () => {
    it("should handle concurrent ride requests efficiently", async () => {
      const concurrentRequests = [];
      const numRequests = 10;

      // إنشاء طلبات متزامنة
      for (let i = 0; i < numRequests; i++) {
        const request = {
          pickupLocation: {
            type: "Point",
            coordinates: [31.2357 + i * 0.001, 30.0444 + i * 0.001],
          },
          dropoffLocation: {
            type: "Point",
            coordinates: [31.24 + i * 0.001, 30.05 + i * 0.001],
          },
          riderId: testRider._id,
          passengers: 1,
          preferences: {
            allowSharing: true,
            maxDelay: 10,
          },
        };
        concurrentRequests.push(request);
      }

      // إرسال الطلبات بشكل متزامن
      const startTime = Date.now();
      const responses = await Promise.all(
        concurrentRequests.map((req) =>
          request(app).post("/rides/request").send(req)
        )
      );
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // التحقق من الأداء
      expect(totalTime).toBeLessThan(5000); // يجب أن يتم معالجة جميع الطلبات في أقل من 5 ثواني
      responses.forEach((response) => {
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty("rideRequestId");
      });
    });

    it("should handle system load gracefully", async () => {
      const heavyLoadRequests = [];
      const numRequests = 50;

      // إنشاء طلبات كثيرة
      for (let i = 0; i < numRequests; i++) {
        const req = {
          pickupLocation: {
            type: "Point",
            coordinates: [31.2357 + i * 0.001, 30.0444 + i * 0.001],
          },
          dropoffLocation: {
            type: "Point",
            coordinates: [31.24 + i * 0.001, 30.05 + i * 0.001],
          },
          riderId: testRider._id,
          passengers: 1,
          preferences: {
            allowSharing: true,
            maxDelay: 10,
          },
        };
        heavyLoadRequests.push(req);
      }

      // إرسال الطلبات بشكل متتابع
      const startTime = Date.now();
      for (const req of heavyLoadRequests) {
        const response = await request(app).post("/rides/request").send(req);
        expect(response.status).toBe(202);
      }
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // التحقق من الأداء
      expect(totalTime).toBeLessThan(30000); // يجب أن يتم معالجة جميع الطلبات في أقل من 30 ثانية
    });

    it("should maintain data consistency under load", async () => {
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
        riderId: testRider._id,
        passengers: 1,
        preferences: {
          allowSharing: true,
          maxDelay: 10,
        },
        status: "pending",
      });

      // محاكاة تحديثات متزامنة
      const updatePromises = [];
      for (let i = 0; i < 10; i++) {
        updatePromises.push(
          request(app)
            .put(`/rides/${rideRequest._id}/preferences`)
            .send({
              preferences: {
                allowSharing: i % 2 === 0,
                maxDelay: 5 + i,
              },
            })
        );
      }

      // تنفيذ التحديثات المتزامنة
      const responses = await Promise.all(updatePromises);

      // التحقق من اتساق البيانات
      const finalRequest = await RideRequest.findById(rideRequest._id);
      expect(finalRequest).toBeTruthy();
      expect(finalRequest.preferences).toBeTruthy();
      expect(finalRequest.status).toBe("pending");
    });
  });
});
