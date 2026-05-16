"use strict";

const { Worker } = require("bullmq");
const { QUEUE_NAME, connection } = require("./positionQueue");
const { getDeviceNotifications } = require("../utils/notificationFetcher");
const { evaluateNotifications } = require("../utils/notificationEvaluator");
const { dispatchAlert } = require("../utils/alertDispatcher");
const { cacheLastPosition } = require("../utils/notificationCache");


async function processPositionJob(job) {
  const packetData = job.data;
  const fullPayload = packetData.fullPayload || {};
  const position = fullPayload.position;
  const device = fullPayload.device;
  const speedKmh = packetData.speedKmh || 0;

  if (!device || !position) {
    console.warn("[Worker] Job " + job.id + ": Missing device or position, skipping");
    return;
  }

  const uniqueId = device.uniqueId;
  console.log("\n[Worker] Processing job " + job.id + " for device " + uniqueId);

  // FETCH NOTIFICATIONS (CACHED)
  const notifications = await getDeviceNotifications(uniqueId);

  if (!notifications.length) {
    console.log("[Worker] No active notifications for device " + uniqueId + ", done.");
    return;
  }

  // Packet data
  const packet = {
    position: position,
    device: device,
    speedKmh: speedKmh,
    rawPacket: packetData,
  };

  // evaluate, is active day, is active time, and parameters.
  const triggered = await evaluateNotifications(uniqueId, notifications, packet);
  console.log({triggered});

  if (triggered.length) {
    console.log("[Worker] " + triggered.length + " notification(s) triggered for device " + uniqueId);
  } else {
    console.log("[Worker] No notifications triggered for device " + uniqueId);
  }

  // dispatch alerts.
  const alertPromises = triggered.map(function(item) {
    return dispatchAlert(item.notif, packet, item.reason);
  });
  await Promise.allSettled(alertPromises);

  // Cache the position
  await cacheLastPosition(uniqueId, packetData);

  console.log("[Worker] Job " + job.id + " complete");
}

function startPositionWorker() {
  let worker = new Worker(QUEUE_NAME, processPositionJob, {
    connection: connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "5"),
  });

  worker.on("completed", function(job) {
    console.log("[Worker] Job " + job.id + " completed");
  });

  worker.on("failed", function(job, err) {
    console.error("[Worker] Job " + (job && job.id) + " failed:", err);
  });

  worker.on("error", function(err) {
    console.error("[Worker] Worker error:", err.message);
  });

  console.log("[Worker] Position worker started (concurrency: " + (process.env.WORKER_CONCURRENCY || 5) + ")");
  return worker;
}

module.exports = { startPositionWorker: startPositionWorker };