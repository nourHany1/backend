const mongoose = require('mongoose');
const User = require('../models/User');
const Trip = require('../models/Trip');
const { startLocationTracking, stopLocationTracking } = require('../services/locationService');
require('dotenv').config();

// بيانات الموقع
const locations = {
  riyadh: {
    latitude: 24.7136,
    longitude: 46.6753
  },
  north: {
    latitude: 24.7236,
    longitude: 46.6853
  },
  south: {
    latitude: 24.7036,
    longitude: 46.6653
  }
};

// إنشاء سائق
async function createDriver() {
  const driver = new User({
    name: 'أحمد السائق',
    email: 'driver@test.com',
    phone: '0500000001',
    role: 'driver',
    currentLocation: {
      type: 'Point',
      coordinates: [locations.riyadh.longitude, locations.riyadh.latitude],
      lastUpdated: new Date()
    },
    driverInfo: {
      carModel: 'تويوتا كامري',
      carColor: 'أبيض',
      licensePlate: 'ABC123',
      isVerified: true
    }
  });

  await driver.save();
  console.log('تم إنشاء السائق:', driver.name);
  return driver;
}

// إنشاء راكب
async function createRider() {
  const rider = new User({
    name: 'محمد الراكب',
    email: 'rider@test.com',
    phone: '0500000002',
    role: 'rider',
    currentLocation: {
      type: 'Point',
      coordinates: [locations.north.longitude, locations.north.latitude],
      lastUpdated: new Date()
    },
    riderInfo: {
      preferredPaymentMethod: 'cash',
      savedLocations: [{
        name: 'المنزل',
        location: {
          type: 'Point',
          coordinates: [locations.north.longitude, locations.north.latitude],
          address: 'حي الشمال، الرياض'
        }
      }]
    }
  });

  await rider.save();
  console.log('تم إنشاء الراكب:', rider.name);
  return rider;
}

// إنشاء رحلة
async function createTrip(driver) {
  const trip = new Trip({
    driver: driver._id,
    status: 'pending',
    startLocation: {
      type: 'Point',
      coordinates: [locations.riyadh.longitude, locations.riyadh.latitude],
      address: 'وسط الرياض'
    },
    endLocation: {
      type: 'Point',
      coordinates: [locations.south.longitude, locations.south.latitude],
      address: 'حي الجنوب، الرياض'
    },
    driverLocation: {
      type: 'Point',
      coordinates: [locations.riyadh.longitude, locations.riyadh.latitude],
      lastUpdated: new Date()
    }
  });

  await trip.save();
  console.log('تم إنشاء الرحلة من', trip.startLocation.address, 'إلى', trip.endLocation.address);
  return trip;
}

// محاكاة الرحلة
async function simulateTrip(trip, driver, rider) {
  console.log('\nبدء محاكاة الرحلة...');

  // 1. البحث عن رحلات قريبة
  console.log('\n1. البحث عن رحلات قريبة:');
  const nearbyTrips = await Trip.find({
    status: 'pending',
    startLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [locations.north.longitude, locations.north.latitude]
        },
        $maxDistance: 5000
      }
    }
  }).populate('driver', 'name rating currentLocation');
  console.log('الرحلات القريبة:', nearbyTrips.length);

  // 2. إضافة الراكب إلى الرحلة
  console.log('\n2. إضافة الراكب إلى الرحلة:');
  trip.riders.push({
    user: rider._id,
    pickupLocation: {
      type: 'Point',
      coordinates: [locations.north.longitude, locations.north.latitude],
      address: 'موقع الراكب'
    },
    dropoffLocation: {
      type: 'Point',
      coordinates: [locations.south.longitude, locations.south.latitude],
      address: 'وجهة الراكب'
    }
  });
  await trip.save();
  console.log('تم إضافة الراكب إلى الرحلة');

  // 3. بدء الرحلة
  console.log('\n3. بدء الرحلة:');
  trip.status = 'in_progress';
  await trip.save();
  console.log('تم بدء الرحلة');

  // 4. محاكاة تحرك السائق
  console.log('\n4. محاكاة تحرك السائق:');
  let trackingInterval;
  try {
    trackingInterval = startLocationTracking(driver._id, trip._id);
    console.log('تم بدء تتبع موقع السائق');
    
    // محاكاة تحرك السائق
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const updatedTrip = await Trip.findById(trip._id)
        .populate('driver', 'currentLocation');
      console.log(`موقع السائق الحالي: [${updatedTrip.driverLocation.coordinates[1]}, ${updatedTrip.driverLocation.coordinates[0]}]`);
    }
  } catch (error) {
    console.log('ملاحظة: تم تجاهل تحديثات الموقع في الوقت الفعلي (Socket.IO غير متوفر في بيئة الاختبار)');
  }
  
  // 5. تحديث حالة الراكب إلى "تم التقاطه"
  console.log('\n5. تحديث حالة الراكب:');
  trip.riders[0].status = 'picked_up';
  await trip.save();
  console.log('تم التقاط الراكب');

  // انتظار 10 ثوانٍ أخرى لمحاكاة الرحلة
  await new Promise(resolve => setTimeout(resolve, 10000));

  // 6. إكمال الرحلة
  console.log('\n6. إكمال الرحلة:');
  trip.status = 'completed';
  trip.riders[0].status = 'dropped_off';
  await trip.save();
  stopLocationTracking(trackingInterval);
  console.log('تم إكمال الرحلة');

  // 7. عرض تفاصيل الرحلة النهائية
  console.log('\n7. تفاصيل الرحلة النهائية:');
  const finalTrip = await Trip.findById(trip._id)
    .populate('driver', 'name phone rating currentLocation')
    .populate('riders.user', 'name phone currentLocation');
  console.log(JSON.stringify(finalTrip, null, 2));
}

// تشغيل السيناريو
async function runScenario() {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('تم الاتصال بقاعدة البيانات');

    // حذف البيانات القديمة
    await User.deleteMany({});
    await Trip.deleteMany({});
    console.log('تم حذف البيانات القديمة');

    // إنشاء المستخدمين والرحلة
    const driver = await createDriver();
    const rider = await createRider();
    const trip = await createTrip(driver);

    // محاكاة الرحلة
    await simulateTrip(trip, driver, rider);

    console.log('\nتم الانتهاء من محاكاة السيناريو بنجاح!');
  } catch (error) {
    console.error('حدث خطأ:', error);
  } finally {
    await mongoose.disconnect();
    console.log('تم قطع الاتصال بقاعدة البيانات');
  }
}

// تشغيل السيناريو
runScenario(); 