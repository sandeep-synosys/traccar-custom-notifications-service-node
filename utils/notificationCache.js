const { createClient } = require("redis");

const NOTIFICATION_CACHE_TTL = 60 * 5; // 5 minutes
const COOLDOWN_TTL = 60 * 5; // 5 min cooldown between same alert fires

let redisClient = null;

async function getRedisClient() {
  if (redisClient && redisClient.isOpen) return redisClient;

  redisClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  });

  redisClient.on("error", (err) =>
    console.error("[Redis] Error:", err.message)
  );

  redisClient.on("connect", () =>
    console.log("[Redis] Connected")
  );

  await redisClient.connect();
  return redisClient;
}

const deviceNotifKey = (uniqueId) => `notif:device:${uniqueId}`;

const cooldownKey = (uniqueId, notifId, type) =>
  `cooldown:${uniqueId}:${notifId}:${type}`;

async function cacheDeviceNotifications(uniqueId, notifications) {
  const client = await getRedisClient();
  const key = deviceNotifKey(uniqueId);

  await client.setEx(
    key,
    NOTIFICATION_CACHE_TTL,
    JSON.stringify(notifications)
  );

  console.log(
    `[Cache] Stored ${notifications.length} notifications for device ${uniqueId}`
  );
}

async function getCachedDeviceNotifications(uniqueId) {
  const client = await getRedisClient();
  const key = deviceNotifKey(uniqueId);

  const raw = await client.get(key);
  if (!raw) return null;

  return JSON.parse(raw);
}

async function invalidateDeviceNotifications(uniqueId) {
  const client = await getRedisClient();
  await client.del(deviceNotifKey(uniqueId));
}

async function isInCooldown(
  uniqueId,
  notifId,
  type,
  cooldownSeconds = COOLDOWN_TTL
) {
  const client = await getRedisClient();
  const key = cooldownKey(uniqueId, notifId, type);

  const exists = await client.exists(key);
  return exists === 1;
}

async function setCooldown(
  uniqueId,
  notifId,
  type,
  cooldownSeconds = COOLDOWN_TTL
) {
  const client = await getRedisClient();
  const key = cooldownKey(uniqueId, notifId, type);

  await client.setEx(key, cooldownSeconds, "1");
}

async function cacheLastPosition(uniqueId, positionData) {
  const client = await getRedisClient();

  await client.setEx(
    `lastpos:${uniqueId}`,
    60 * 60, // 1 hour
    JSON.stringify(positionData)
  );
}

async function getLastPosition(uniqueId) {
  const client = await getRedisClient();

  const raw = await client.get(`lastpos:${uniqueId}`);
  return raw ? JSON.parse(raw) : null;
}

module.exports = {
  getRedisClient,
  cacheDeviceNotifications,
  getCachedDeviceNotifications,
  invalidateDeviceNotifications,
  isInCooldown,
  setCooldown,
  cacheLastPosition,
  getLastPosition,
};