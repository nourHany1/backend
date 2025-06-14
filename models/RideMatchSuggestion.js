const mongoose = require("mongoose");

const rideMatchSuggestionSchema = new mongoose.Schema(
  {
    rideRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RideRequest",
      required: true,
    },
    suggestedDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    potentialRiders: [
      {
        riderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        estimatedDelayMinutes: {
          type: Number,
          required: true,
        },
        compatibilityScore: {
          type: Number,
          required: true,
        },
        routeImpact: {
          type: Number,
          required: true,
        },
        pickupOrder: {
          type: Number,
          required: true,
        },
        dropoffOrder: {
          type: Number,
          required: true,
        },
      },
    ],
    optimizedRoute: {
      type: {
        type: String,
        enum: ["LineString"],
        required: true,
      },
      coordinates: {
        type: [[Number]],
        required: true,
      },
      estimatedTime: {
        type: Number,
        required: true,
      },
      trafficImpact: {
        type: Number,
        required: true,
      },
      totalDistance: {
        type: Number,
        required: true,
      },
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired"],
      default: "pending",
    },
    estimatedPrice: {
      type: Number,
      required: true,
    },
    pricePerRider: [
      {
        riderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    currentLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    estimatedArrival: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// إنشاء فهارس للبحث السريع
rideMatchSuggestionSchema.index({ status: 1 });
rideMatchSuggestionSchema.index({ rideRequestId: 1 });
rideMatchSuggestionSchema.index({ suggestedDriverId: 1 });
rideMatchSuggestionSchema.index({ optimizedRoute: "2dsphere" });
rideMatchSuggestionSchema.index({ currentLocation: "2dsphere" });

// إضافة middleware لتعيين تاريخ انتهاء الصلاحية
rideMatchSuggestionSchema.pre("save", function (next) {
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 دقائق من الآن
  }
  next();
});

const RideMatchSuggestion = mongoose.model(
  "RideMatchSuggestion",
  rideMatchSuggestionSchema
);

module.exports = RideMatchSuggestion;
