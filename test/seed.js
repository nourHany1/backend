const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker/locale/ar');
require('dotenv').config();

// استيراد النماذج
const User = require('../models/User');
const Trip = require('../models/Trip');
const RideBooking = require('../models/RideBooking');

// دالة لإنشاء موقع عشوائي في القاهرة
const generateCairoLocation = () => {
  return {
    type: 'Point',
    coordinates: [
      faker.number.float({ min: 31.2, max: 31.4, precision: 0.0001 }), // خط الطول
      faker.number.float({ min: 30.0, max: 30.1, precision: 0.0001 })  // خط العرض
    ]
  };
};

// دالة لإنشاء مستخدمين
const createUsers = async (count) => {
  const users = [];
  for (let i = 0; i < count; i++) {
    const user = new User({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number('01########'),
      role: faker.helpers.arrayElement(['driver', 'rider']),
      rating: faker.number.float({ min: 3, max: 5, precision: 0.1 }),
      isAvailable: faker.datatype.boolean(),
      currentLocation: generateCairoLocation()
    });
    users.push(user);
  }
  return User.insertMany(users);
};

// دالة لإنشاء رحلات
const createTrips = async (drivers) => {
  const trips = [];
  for (const driver of drivers) {
    const trip = new Trip({
      driver: driver._id,
      status: faker.helpers.arrayElement(['pending', 'active', 'completed']),
      startLocation: {
        type: 'Point',
        coordinates: generateCairoLocation().coordinates,
        address: faker.location.streetAddress()
      },
      endLocation: {
        type: 'Point',
        coordinates: generateCairoLocation().coordinates,
        address: faker.location.streetAddress()
      },
      availableSeats: faker.number.int({ min: 1, max: 4 }),
      price: faker.number.int({ min: 20, max: 100 }),
      estimatedDuration: faker.number.int({ min: 10, max: 60 }),
      estimatedDistance: faker.number.float({ min: 2, max: 20, precision: 0.1 })
    });
    trips.push(trip);
  }
  return Trip.insertMany(trips);
};

// دالة لإنشاء حجوزات
const createBookings = async (trips, riders) => {
  const bookings = [];
  for (const trip of trips) {
    const numPassengers = faker.number.int({ min: 1, max: trip.availableSeats });
    for (let i = 0; i < numPassengers; i++) {
      const rider = faker.helpers.arrayElement(riders);
      const booking = new RideBooking({
        rider: rider._id,
        trip: trip._id,
        status: faker.helpers.arrayElement(['pending', 'accepted', 'completed']),
        pickupLocation: {
          type: 'Point',
          coordinates: generateCairoLocation().coordinates,
          address: faker.location.streetAddress()
        },
        dropoffLocation: {
          type: 'Point',
          coordinates: generateCairoLocation().coordinates,
          address: faker.location.streetAddress()
        },
        price: trip.price,
        estimatedDuration: faker.number.int({ min: 10, max: 60 }),
        estimatedDistance: faker.number.float({ min: 2, max: 20, precision: 0.1 }),
        rating: faker.number.int({ min: 1, max: 5 }),
        review: faker.lorem.sentence()
      });
      bookings.push(booking);
    }
  }
  return RideBooking.insertMany(bookings);
};

// دالة الاختبار الرئيسية
const seedDatabase = async () => {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-ride-sharing');
    console.log('تم الاتصال بقاعدة البيانات');

    // حذف البيانات القديمة
    await Promise.all([
      User.deleteMany({}),
      Trip.deleteMany({}),
      RideBooking.deleteMany({})
    ]);
    console.log('تم حذف البيانات القديمة');

    // إنشاء بيانات جديدة
    const users = await createUsers(20);
    console.log('تم إنشاء المستخدمين');

    const drivers = users.filter(user => user.role === 'driver');
    const riders = users.filter(user => user.role === 'rider');

    const trips = await createTrips(drivers);
    console.log('تم إنشاء الرحلات');

    const bookings = await createBookings(trips, riders);
    console.log('تم إنشاء الحجوزات');

    // طباعة إحصائيات
    console.log('\nإحصائيات قاعدة البيانات:');
    console.log('------------------------');
    console.log(`عدد المستخدمين: ${users.length}`);
    console.log(`عدد السائقين: ${drivers.length}`);
    console.log(`عدد الركاب: ${riders.length}`);
    console.log(`عدد الرحلات: ${trips.length}`);
    console.log(`عدد الحجوزات: ${bookings.length}`);

    // اختبار الوظائف
    console.log('\nاختبار الوظائف:');
    console.log('----------------');

    // اختبار البحث عن رحلات قريبة
    const testLocation = generateCairoLocation();
    const nearbyTrips = await Trip.find({
      status: 'pending',
      availableSeats: { $gt: 0 },
      startLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: testLocation.coordinates
          },
          $maxDistance: 5000
        }
      }
    }).populate('driver', 'name rating');
    console.log(`عدد الرحلات القريبة: ${nearbyTrips.length}`);

    // اختبار حجوزات المستخدم
    const testUser = riders[0];
    const userBookings = await RideBooking.find({ rider: testUser._id })
      .populate('trip')
      .sort({ createdAt: -1 });
    console.log(`عدد حجوزات المستخدم ${testUser.name}: ${userBookings.length}`);

    // اختبار رحلات السائق
    const testDriver = drivers[0];
    const driverTrips = await Trip.find({ driver: testDriver._id })
      .populate('passengers.rider', 'name rating')
      .sort({ createdAt: -1 });
    console.log(`عدد رحلات السائق ${testDriver.name}: ${driverTrips.length}`);

    console.log('\nتم إنشاء البيانات بنجاح! 🎉');
    process.exit(0);
  } catch (error) {
    console.error('حدث خطأ:', error);
    process.exit(1);
  }
};

// تشغيل الاختبار
seedDatabase(); 