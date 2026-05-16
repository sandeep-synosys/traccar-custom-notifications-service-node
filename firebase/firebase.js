const admin = require("firebase-admin");
const fcm = require("fcm-notification");

const serviceAccount = require("./privatekey.json");
const certPath = admin.credential.cert(serviceAccount);

const FirebaseNotification = new fcm(certPath);

module.exports = {FirebaseNotification}