const TblNotificationObjects = require("../models/TblNotificationObjects");
const TblNotifications = require("../models/TblNotifications");
const { cacheDeviceNotifications, getCachedDeviceNotifications } = require("../utils/notificationCache");


async function getDeviceNotifications(uniqueId) {
  // check if cached uniqueid notifications
  const cached = await getCachedDeviceNotifications(uniqueId);
  if (cached !== null) {
    console.log(`[NotifFetch] Cache HIT for device ${uniqueId} (${cached.length} notifications)`);
    return cached;
  }

  console.log(`[NotifFetch] Cache MISS for device ${uniqueId}, querying DB...`);

  const notifObjects = await TblNotificationObjects.findAll({
    where: {
      notification_objects_obj_device_id: uniqueId,
      notification_objects_status: "1",
    },
    raw: true,
  });

  if (!notifObjects.length) {
    await cacheDeviceNotifications(uniqueId, []);
    return [];
  }

  const notifIds = notifObjects.map((o) => o.notification_objects_notifn_id);

  // Fetch the actual notification configs
  const notifications = await TblNotifications.findAll({
    where: {
      notification_id: notifIds,
      notification_status: "active",
      notification_type: ["roadspeedlimit", "temperature", "fuel"],
    },
    raw: true,
  });

  console.log(`[NotifFetch] Found ${notifications.length} active notifications for device ${uniqueId}`);

  await cacheDeviceNotifications(uniqueId, notifications);
  return notifications;
}

module.exports = { getDeviceNotifications };