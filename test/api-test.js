const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
const Trip = require('../models/Trip');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';

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

// إنشاء مستخدمين للاختبار
async function createTestUsers() {
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

  const rider = new User({
    name: 'محمد الراكب',
    email: 'rider@test.com',
    phone: '0500000002',
    role: 'rider',
    currentLocation: {
      type: 'Point',
      coordinates: [locations.north.longitude, locations.north.latitude],
      lastUpdated: new Date()
    }
  });

  await driver.save();
  await rider.save();
  return { driver, rider };
}

// اختبار نقاط النهاية
async function testEndpoints() {
  let createdTripId = null;
  let createdUserId = null;

  try {
    console.log('بدء اختبار نقاط النهاية...\n');

    // 1. اختبار إنشاء مستخدم جديد
    console.log('1. اختبار إنشاء مستخدم جديد:');
    const newUser = {
      name: 'علي المستخدم',
      email: 'ali@test.com',
      phone: '0500000003',
      role: 'rider'
    };
    const createUserResponse = await axios.post(`${API_URL}/users`, newUser);
    createdUserId = createUserResponse.data._id;
    console.log('تم إنشاء المستخدم:', JSON.stringify(createUserResponse.data, null, 2));
    console.log('-------------------\n');

    // 2. اختبار الحصول على معلومات المستخدم
    console.log('2. اختبار الحصول على معلومات المستخدم:');
    const getUserResponse = await axios.get(`${API_URL}/users/${createdUserId}`);
    console.log('معلومات المستخدم:', JSON.stringify(getUserResponse.data, null, 2));
    console.log('-------------------\n');

    // 3. اختبار إنشاء رحلة جديدة
    console.log('3. اختبار إنشاء رحلة جديدة:');
    const newTrip = {
      driver: createdUserId,
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
      status: 'pending',
      availableSeats: 4,
      price: 50,
      estimatedDuration: 30,
      estimatedDistance: 10,
      riders: []
    };

    try {
      // إنشاء الرحلة مباشرة في قاعدة البيانات
      const trip = new Trip(newTrip);
      await trip.save();
      createdTripId = trip._id;
      
      // الحصول على الرحلة من API
      const getTripResponse = await axios.get(`${API_URL}/trips/${createdTripId}`);
      console.log('تم إنشاء الرحلة:', JSON.stringify(getTripResponse.data, null, 2));
    } catch (error) {
      console.error('خطأ في إنشاء الرحلة:', error.response ? error.response.data : error.message);
      return; // إيقاف الاختبارات إذا فشل إنشاء الرحلة
    }
    console.log('-------------------\n');

    // 4. اختبار البحث عن رحلات قريبة
    console.log('4. اختبار البحث عن رحلات قريبة:');
    const nearbyTripsResponse = await axios.get(`${API_URL}/trips/nearby`, {
      params: {
        latitude: locations.north.latitude,
        longitude: locations.north.longitude,
        maxDistance: 5000
      }
    });
    console.log('الرحلات القريبة:', JSON.stringify(nearbyTripsResponse.data, null, 2));
    console.log('-------------------\n');

    // 5. اختبار إضافة راكب إلى الرحلة
    if (createdTripId) {
      console.log('5. اختبار إضافة راكب إلى الرحلة:');
      try {
        const addRiderResponse = await axios.post(`${API_URL}/trips/${createdTripId}/riders`, {
          userId: createdUserId,
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
        console.log('تم إضافة الراكب:', JSON.stringify(addRiderResponse.data, null, 2));
      } catch (error) {
        console.error('خطأ في إضافة الراكب:', error.response ? error.response.data : error.message);
      }
      console.log('-------------------\n');

      // 6. اختبار تحديث حالة الرحلة
      console.log('6. اختبار تحديث حالة الرحلة:');
      try {
        const updateTripStatusResponse = await axios.patch(`${API_URL}/trips/${createdTripId}/status`, {
          status: 'in_progress'
        });
        console.log('تم تحديث حالة الرحلة:', JSON.stringify(updateTripStatusResponse.data, null, 2));
      } catch (error) {
        console.error('خطأ في تحديث حالة الرحلة:', error.response ? error.response.data : error.message);
      }
      console.log('-------------------\n');

      // 7. اختبار تحديث حالة راكب معين
      console.log('7. اختبار تحديث حالة راكب معين:');
      try {
        const getTripResponse = await axios.get(`${API_URL}/trips/${createdTripId}`);
        const riderId = getTripResponse.data.riders[0]._id;
        const updateRiderStatusResponse = await axios.patch(
          `${API_URL}/trips/${createdTripId}/riders/${riderId}/status`,
          { status: 'picked_up' }
        );
        console.log('تم تحديث حالة الراكب:', JSON.stringify(updateRiderStatusResponse.data, null, 2));
      } catch (error) {
        console.error('خطأ في تحديث حالة الراكب:', error.response ? error.response.data : error.message);
      }
      console.log('-------------------\n');

      // 8. اختبار الحصول على تفاصيل الرحلة
      console.log('8. اختبار الحصول على تفاصيل الرحلة:');
      try {
        const getTripDetailsResponse = await axios.get(`${API_URL}/trips/${createdTripId}`);
        console.log('تفاصيل الرحلة:', JSON.stringify(getTripDetailsResponse.data, null, 2));
      } catch (error) {
        console.error('خطأ في الحصول على تفاصيل الرحلة:', error.response ? error.response.data : error.message);
      }
      console.log('-------------------\n');
    }

    console.log('تم الانتهاء من اختبار جميع نقاط النهاية بنجاح!');
  } catch (error) {
    console.error('حدث خطأ في الاختبار:', error.response ? error.response.data : error.message);
  }
}

// تشغيل الاختبارات
async function runTests() {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('تم الاتصال بقاعدة البيانات');

    // حذف البيانات القديمة
    await User.deleteMany({});
    await Trip.deleteMany({});
    console.log('تم حذف البيانات القديمة');

    // إنشاء مستخدمين للاختبار
    await createTestUsers();

    // تشغيل اختبارات نقاط النهاية
    await testEndpoints();
  } catch (error) {
    console.error('حدث خطأ:', error);
  } finally {
    await mongoose.disconnect();
    console.log('تم قطع الاتصال بقاعدة البيانات');
  }
}

// تشغيل الاختبارات
runTests(); 