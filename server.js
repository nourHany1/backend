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
      console.log("Connected to the database");
      server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Failed to connect to the database", err);
    });
}

module.exports = app;
