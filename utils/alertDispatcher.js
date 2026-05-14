"use strict";

const { logToFile } = require("../app");
const { _Mail } = require("../mails/mail");


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
  // TODO: insert into tc_tbl_alerts or push via WebSocket / FCM
  console.log("[Alert:App] Notification " + notif.notification_id + " fired");
  console.log("  Device: " + (packet.device && packet.device.name));
  console.log("  Reason: " + reason);
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
      for (const i = 0; i < emails.length; i++) {
        dispatches.push(sendEmail(emails[i].trim(), subject, body));
      }
    }

    // In-app alert
    if (notif.notification_alert === "1" || notif.notification_alert_app === "1") {
      dispatches.push(sendAppAlert(notif, packet, reason));
    }

    await Promise.allSettled(dispatches);

    console.log({ notif, dispatches })

    // Audit log
    logToFile("alerts.log", {
      time: new Date().toISOString(),
      deviceName: deviceName,
      uniqueId: device && device.uniqueId,
      notificationId: notif.notification_id,
      notificationType: notif.notification_type,
      reason: reason,
      speedKmh: speedKmh,
      lat: lat,
      lng: lng,
    });
  } catch (error) {
    console.log("[Alert Dispatcher] " + error.message)
  }

}

module.exports = { dispatchAlert };