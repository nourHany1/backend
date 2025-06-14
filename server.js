const mongoose = require("mongoose");
const http = require("http");
const socketIO = require("./socket");
require("dotenv").config();

const app = require("./app");
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
  mongoose
    .connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/ride-sharing"
    )
    .then(() => {
      console.log("تم الاتصال بقاعدة البيانات");
      server.listen(PORT, () => {
        console.log(`الخادم يعمل على المنفذ ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("فشل الاتصال بقاعدة البيانات", err);
    });
}

module.exports = app;
