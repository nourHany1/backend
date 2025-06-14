const Trip = require('../models/Trip');
const User = require('../models/User');
let socketIO;

try {
  socketIO = require('../socket');
} catch (error) {
  console.log('ملاحظة: Socket.IO غير متوفر في بيئة الاختبار');
}

// تحديث موقع السائق
async function updateDriverLocation(driverId, tripId, location) {
  try {
    // تحديث موقع السائق في نموذج المستخدم
    await User.findByIdAndUpdate(driverId, {
      currentLocation: {
        type: 'Point',
        coordinates: [location.longitude, location.latitude],
        lastUpdated: new Date()
      }
    });

    // تحديث موقع السائق في الرحلة النشطة
    const trip = await Trip.findById(tripId);
    if (trip && trip.status === 'in_progress') {
      trip.driverLocation = {
        type: 'Point',
        coordinates: [location.longitude, location.latitude],
        lastUpdated: new Date()
      };
      await trip.save();

      // إرسال تحديث الموقع لجميع الركاب في الرحلة
      if (socketIO) {
        try {
          const io = socketIO.getIO();
          if (io) {
            trip.riders.forEach(rider => {
              io.to(rider.user.toString()).emit('driverLocationUpdate', {
                tripId: trip._id,
                location: {
                  latitude: location.latitude,
                  longitude: location.longitude
                },
                timestamp: new Date()
              });
            });
          }
        } catch (error) {
          // تجاهل أخطاء Socket.IO في بيئة الاختبار
          console.log('تم تحديث الموقع في قاعدة البيانات فقط');
        }
      }
    }

    return true;
  } catch (error) {
    console.error('خطأ في تحديث موقع السائق:', error);
    return false;
  }
}

// بدء تتبع موقع السائق
function startLocationTracking(driverId, tripId, updateInterval = 5000) {
  const intervalId = setInterval(async () => {
    // هنا سيتم الحصول على الموقع الحالي من تطبيق Flutter
    // في الوقت الحالي، سنستخدم موقع وهمي للاختبار
    const mockLocation = {
      latitude: 24.7136 + (Math.random() * 0.01),
      longitude: 46.6753 + (Math.random() * 0.01)
    };

    const success = await updateDriverLocation(driverId, tripId, mockLocation);
    if (!success) {
      clearInterval(intervalId);
    }
  }, updateInterval);

  return intervalId;
}

// إيقاف تتبع موقع السائق
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