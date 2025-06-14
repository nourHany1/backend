const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

// تعطيل التحذيرات
mongoose.set("strictQuery", false);

// الاتصال بقاعدة بيانات الاختبار
beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("تم الاتصال بقاعدة بيانات الاختبار في الذاكرة بنجاح");
  } catch (error) {
    console.error("فشل الاتصال بقاعدة بيانات الاختبار:", error);
    throw error;
  }
});

// تنظيف قاعدة البيانات بعد كل اختبار
afterEach(async () => {
  if (mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany({});
    }
  }
});

// إغلاق الاتصال بعد الانتهاء من جميع الاختبارات
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
  console.log("تم إغلاق الاتصال بقاعدة بيانات الاختبار");
});
