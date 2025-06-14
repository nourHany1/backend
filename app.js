const express = require("express");
const app = express();
const ridesRouter = require("./routes/rides");
const driversRouter = require("./routes/drivers");
const usersRouter = require("./routes/users");
const notificationsRouter = require("./routes/notifications");
const tripsRouter = require("./routes/trips");

app.use(express.json());
app.use("/rides", ridesRouter);
app.use("/drivers", driversRouter);
app.use("/users", usersRouter);
app.use("/notifications", notificationsRouter);
app.use("/trips", tripsRouter);

module.exports = app;
