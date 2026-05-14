const { isInCooldown, setCooldown } = require("./notificationCache");
const { getRoadSpeed } = require("./valhallaClient");

// FOR CHECKING IF NOTIFICATION ENABLED FOR THE DAY
function isActiveDay(notif, date) {
  date = date || new Date();
  const days = [
    "notification_sunday",
    "notification_monday",
    "notification_tuesday",
    "notification_wednesday",
    "notification_thursday",
    "notification_friday",
    "notification_saturday",
  ];
  const dayField = days[date.getDay()];
  return notif[dayField] === "1";
}

// EVALUATING IF TRIGGERED IS WITH IN THE TIME RANGE
function isActiveTime(notif, date) {
  date = date || new Date();
  const from = notif.notification_time_from;
  const to = notif.notification_time_to;
  if (!from && !to) return true;

  const pad = function (n) { return String(n).padStart(2, "0"); };
  const nowStr = pad(date.getHours()) + ":" + pad(date.getMinutes());

  if (from && to) {
    return nowStr >= from && nowStr <= to;
  }
  return true;
}

// EVALUATING SPEED VS ROAD SPEED FROM OSM
async function evaluateSpeed(notif, packet) {
  const speedKmh = packet.speedKmh;
  const position = packet.position;
  const useRoadSpeed = notif.notification_type === "roadspeedlimit";

  let threshold;
  let roadSpeedInfo = null;
  let thresholdSource;

  if (useRoadSpeed) {
    // coordinates
    const lat = position.latitude;
    const lng = position.longitude;

    if (!lat || !lng) {
      return {
        triggered: false,
        reason: "Road speed mode: no valid GPS coordinates in packet",
        roadSpeedInfo: null,
      };
    }

    roadSpeedInfo = await getRoadSpeed(lat, lng);
    console.log({ roadSpeedInfo })

    if (roadSpeedInfo.error) {
      return {
        triggered: false,
        reason: "Road speed mode: Valhalla unavailable — " + roadSpeedInfo.error,
        roadSpeedInfo: roadSpeedInfo,
      };
    }
    if (roadSpeedInfo.ambiguous) {
      return {
        triggered: false,
        reason: "Road speed mode: Ambigous speed multiple matching edges",
        roadSpeedInfo: roadSpeedInfo,
      };
    }

    // Prefer posted speed_limit; fall back to routing speed derived from road class
    threshold = roadSpeedInfo.speedLimit;

    if (!threshold) {
      return {
        triggered: false,
        reason: "Road speed mode: no speed data available for this location",
        roadSpeedInfo: roadSpeedInfo,
      };
    }

    thresholdSource = roadSpeedInfo.speedLimit !== null
      ? ("road speed limit (" + threshold + " km/h " + position?.address + ")")
      : ("routing speed fallback (" + threshold + " km/h, no posted limit)");

  }

  let triggered = false;
  switch (notif.notification_speed_parameters) {
    case "Is Greater than": triggered = speedKmh > threshold; break;
    case "Is Equal to": triggered = speedKmh === threshold; break;
    case "Is Less than": triggered = speedKmh < threshold; break;
    default: triggered = false;
  }

  const reason = triggered
    ? ("Vehicle speed " + speedKmh + " km/h " + notif.notification_speed_parameters + " " + thresholdSource)
    : ("Speed " + speedKmh + " km/h within " + thresholdSource);

  return { triggered: triggered, reason: reason, roadSpeedInfo: roadSpeedInfo };
}

function evaluateTemperature() { };
function evaluateFuel() { };

async function evaluateNotification(notif, packet) {
  const position = packet.position;
  const speedKmh = packet.speedKmh;
  const now = new Date(position.deviceTime || position.serverTime || Date.now());

  if (!isActiveDay(notif, now)) {
    return { triggered: false, reason: "outside active day" };
  }
  if (!isActiveTime(notif, now)) {
    return { triggered: false, reason: "outside active time window" };
  }

  let triggered = false;
  let reason = "";

  switch (notif.notification_type) {
    case "roadspeedlimit":
      res = await evaluateSpeed(notif, packet);
      triggered = res.triggered;
      reason = res.reason;
      break;

    // need to change below helper funcitons
    case "temperature":
      res = evaluateTemperature(notif, position);
      triggered = res.triggered;
      reason = res.reason;
      break;

    case "fuel":
      res = evaluateFuel(notif, position);
      triggered = res.triggered;
      reason = res.reason;
      break;

    default:
      reason = "Unhandled notification type: " + notif.notification_type;
  }

  return { triggered: triggered, reason: reason };
}

async function evaluateNotifications(uniqueId, notifications, packet) {
  if (!notifications.length) return [];

  const toFire = [];

  for (let i = 0; i < notifications.length; i++) {
    const notif = notifications[i];
    // CHECK IF ALREADY SENT NOTIFICATION WITHIN 5 MINS COOLDOWN
    const inCooldown = await isInCooldown(uniqueId, notif.notification_id, notif.notification_type);

    if (inCooldown) {
      console.log(
        "[Evaluator] Notification " + notif.notification_id +
        " (" + notif.notification_type + ") in cooldown for device " + uniqueId
      );
      continue;
    }

    const result = await evaluateNotification(notif, packet);

    // SKIP IF NOT TRIGGERED
    if (!result.triggered) continue;

    await setCooldown(uniqueId, notif.notification_id, notif.notification_type);
    toFire.push({ notif: notif, reason: result.reason });
  }

  return toFire;
}

module.exports = { evaluateNotifications };