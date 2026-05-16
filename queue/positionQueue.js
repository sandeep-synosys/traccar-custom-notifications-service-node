"use strict";

const { Queue } = require("bullmq");

const QUEUE_NAME = "position-packets";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
};

let positionQueue = null;

function getPositionQueue() {
  if (positionQueue) return positionQueue;

  positionQueue = new Queue(QUEUE_NAME, {
    connection: connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 500 }, 
      removeOnFail: { count: 100 },   
    },
  });

  console.log("[Queue] Position queue initialized: " + QUEUE_NAME);
  return positionQueue;
}

async function enqueuePositionPacket(packetData) {
  const queue = getPositionQueue();
  const uniqueId =
    (packetData.fullPayload && packetData.fullPayload.device && packetData.fullPayload.device.uniqueId) ||
    packetData.deviceId;

  const fixTime =
    (packetData.fullPayload && packetData.fullPayload.position && packetData.fullPayload.position.fixTime) ||
    Date.now();

  const job = await queue.add("process-position", packetData, {
    jobId: uniqueId + "-" + fixTime,
  });

  console.log("[Queue] Enqueued job " + job.id + " for device " + uniqueId);
  return job;
}

module.exports = {
  getPositionQueue: getPositionQueue,
  enqueuePositionPacket: enqueuePositionPacket,
  QUEUE_NAME: QUEUE_NAME,
  connection: connection,
};