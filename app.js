const express = require("express");
const app = express();
const ridesRouter = require("./routes/rides");

app.use(express.json());
app.use("/rides", ridesRouter);

module.exports = app;
