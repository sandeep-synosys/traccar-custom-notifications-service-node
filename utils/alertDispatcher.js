"use strict";

const { logToFile } = require("../app");
const { _pushNotification } = require("../firebase/pushNotification");
const { _Mail } = require("../mails/mail");
const UsersModel = require("../schemas/UserSchema");


async function sendEmail(to, subject, body) {
  if (!to) return;

  const mail = {
    to,
    subject,
    template: "notification.html",
    context: {
      subject: subject,
      vehicleName: body.vehicleName,
      message: body.message,
      time: body.time,
    },
  };

  await _Mail(mail);
  console.log("Notification Email sent to : ", to);
  return true;
}

async function sendAppAlert(notif, packet, reason) {
  try {
    const organization = notif.notification_org_id;
    const userId = notif.notification_user_id;

    if (!organization || !userId) {
      return;
    }

    // Find user tokens stored in db
    const user = await UsersModel.findOne({
      organization,
      user_id: userId,
    }).select("deviceToken appDeviceToken");

    if (!user) {
      return;
    }

    const title = notif.notification_name || "Alert";
    const message = reason || "Notification triggered";

    const extraData = {
      deviceId: packet.device?.id,
      deviceName: packet.device?.name,
      eventType: notif.notification_type,
      timestamp: packet?.deviceTime || new Date(),
    };

    // Send to deviceToken
    if (user.deviceToken?.length) {
      for (const token of user.deviceToken) {
        if (token) {
          await _pushNotification(
            title,
            message,
            token,
            extraData
          );
        }
      }
    }

    // Send to appDeviceToken
    if (user.appDeviceToken?.length) {
      for (const token of user.appDeviceToken) {
        if (token) {
          await _pushNotification(
            title,
            message,
            token,
            extraData
          );
        }
      }
    }
    console.log(
      `[Alert:App] Notification ${notif.notification_id} sent to user ${userId}`
    );
  } catch (error) {
    console.log(
      `[Alert:App] Failed for notification ${notif.notification_id}`,
      error
    );
  }
}

async function dispatchAlert(notif, packet, reason) {
  try {
    const device = packet.device;
    const position = packet.position;
    const speedKmh = packet.speedKmh;

    const vehicleName = (device && device.name) || ("Device " + (device && device.uniqueId));
    const lat = position.latitude;
    const lng = position.longitude;
    const tz = "Asia/Dubai";
    const time = new Date(position.deviceTime || Date.now()).toLocaleString("en-AE", { timeZone: tz });

    const subject = "LOCATOR Notification - " + vehicleName;
    const body = { vehicleName, message: reason, time };

    const dispatches = [];

    // Email
    if (notif.notification_email) {
      const emails = notif.notification_email.split(",");
      for (let i = 0; i < emails.length; i++) {
        dispatches.push(sendEmail(emails[i].trim(), subject, body));
      }
    }

    // firebase push notification (alert)
    if (notif.notification_alert === "1" || notif.notification_alert_app === "1") {
      dispatches.push(sendAppAlert(notif, packet, reason));
    }

    await Promise.allSettled(dispatches);

    // Audit log customtriggeredNotifications (Only store temperature, fuel and road speed limit notifications)
  } catch (error) {
    console.log("[Alert Dispatcher] " + error.message)
  }

}

module.exports = { dispatchAlert };