require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");

const { enqueuePositionPacket } = require("./queue/positionQueue");
const { startPositionWorker } = require("./queue/positionWorker");
const sequelize = require("./db/sql");
const { invalidateDeviceNotifications } = require("./utils/notificationCache");

const app = express();
const PORT = process.env.PORT || 3000;

const initializeSQLConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("SQL connection established successfully.");
  } catch (error) {
    console.log("Error in establishing connection to the database :: ", error);
  }
};

// connection to sql
initializeSQLConnection();


app.use(express.json({ limit: "5mb" }));

const logsDir = path.join(__dirname, "logs");

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logToFile = (filename, data) => {
  try {
    const filePath = path.join(logsDir, filename);

    const logEntry =
      `[${new Date().toISOString()}]\n` +
      JSON.stringify(data, null, 2) +
      "\n--------------------------------------------------\n";

    fs.appendFileSync(filePath, logEntry);
  } catch (err) {
    console.error("File log error:", err.message);
  }
};

app.get("/", (_, res) => {
  res.json({
    success: true,
    message: "Traccar Forward Server Running",
  });
});

app.post("/positions", async (req, res) => {
  try {
    const {position, device} = req.body;

    const logData = {
      receivedAt: new Date().toISOString(),
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      deviceId: position.deviceId,
      latitude: position.latitude,
      longitude: position.longitude,
      speedKnots: position.speed,
      speedKmh: position.speed
        ? Number((position.speed * 1.852).toFixed(2))
        : 0,
      course: position.course,
      fixTime: position.fixTime,
      protocol: position.protocol,
      attributes: position.attributes || {},
      fullPayload: req.body,
    };

    console.log("\n================ POSITION RECEIVED ================");
    console.log(
      `Device: ${device?.name} (${device?.uniqueId})`
    );
    console.log(
      `Speed: ${logData.speedKmh} km/h | Lat: ${position.latitude} Lng: ${position.longitude}`
    );

    if (enqueuePositionPacket) {
      enqueuePositionPacket(logData).catch((err) => {
        console.error(
          "[App] Failed to enqueue position:",
          err.message
        );

        logToFile("errors.log", {
          time: new Date().toISOString(),
          error: err.message,
        });
      });
    }

    return res.status(200).json({
      success: true,
      message: "Position received",
    });
  } catch (err) {
    console.error("Position endpoint error:", err);

    logToFile("errors.log", {
      time: new Date().toISOString(),
      error: err.message,
      stack: err.stack,
    });

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.post("/cache/invalidate", async (req, res) => {
  try {
    const { uniqueId } = req.body;

    if (!uniqueId) {
      return res.status(400).json({
        error: "uniqueId required",
      });
    }

    await invalidateDeviceNotifications(uniqueId);

    console.log(
      `[Cache] Invalidated notifications for device ${uniqueId}`
    );

    return res.json({
      success: true,
      message: `Cache cleared for ${uniqueId}`,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

async function start() {
  try {
    // Start BullMQ worker in the same process
    startPositionWorker();

    app.listen(PORT, () => {
      console.log(`\nServer running on port ${PORT}`);
      console.log(
        `Endpoint: http://localhost:${PORT}/positions`
      );
      console.log(
        `Cache invalidation: POST http://localhost:${PORT}/cache/invalidate`
      );
    });
  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
}

start();

module.exports = {logToFile}