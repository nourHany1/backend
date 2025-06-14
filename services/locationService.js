const Trip = require('../models/Trip');
const User = require('../models/User');
let socketIO;

try {
  socketIO = require('../socket');
} catch (error) {
  console.log('Note: Socket.IO not available in test environment');
}

// Update driver location
async function updateDriverLocation(driverId, tripId, location) {
  try {
    // Update driver location in User model
    await User.findByIdAndUpdate(driverId, {
      currentLocation: {
        type: "Point",
        coordinates: [location.coordinates[0], location.coordinates[1]],
        lastUpdated: new Date(),
      },
    });

    // Update driver location in active trip
    const trip = await Trip.findById(tripId);
    if (trip && trip.status === "in_progress") {
      trip.driverLocation = {
        type: "Point",
        coordinates: [location.coordinates[0], location.coordinates[1]],
        lastUpdated: new Date(),
      };
      await trip.save();

      // Send location update to all riders in the trip
      if (socketIO) {
        try {
          const io = socketIO.getIO();
          if (io) {
            trip.riders.forEach((rider) => {
              io.to(rider.user.toString()).emit("driverLocationUpdate", {
                tripId: trip._id,
                location: {
                  latitude: location.coordinates[1],
                  longitude: location.coordinates[0],
                },
                timestamp: new Date(),
              });
            });
          }
        } catch (error) {
          // Ignore Socket.IO errors in test environment
          console.log("Location updated in database only");
        }
      }
    }

    return true;
  } catch (error) {
    console.error("Error in updating driver location:", error);
    return false;
  }
}

// Start driver location tracking
function startLocationTracking(driverId, tripId, updateInterval = 5000) {
  const intervalId = setInterval(async () => {
    // This is where the current location would be obtained from the Flutter app
    // For now, we will use a mock location for testing
    const mockLocation = {
      type: "Point",
      coordinates: [
        46.6753 + Math.random() * 0.01,
        24.7136 + Math.random() * 0.01,
      ],
    };

    const success = await updateDriverLocation(driverId, tripId, mockLocation);
    if (!success) {
      clearInterval(intervalId);
    }
  }, updateInterval);

  return intervalId;
}

// Stop driver location tracking
function stopLocationTracking(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
  }
}

module.exports = {
  updateDriverLocation,
  startLocationTracking,
  stopLocationTracking
}; 