const sequelize = require("../db/sql");
const {DataTypes} = require("sequelize")


  const TblNotifications = sequelize.define("TblNotifications", {
    notification_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    notification_org_id: DataTypes.INTEGER,
    notification_name: DataTypes.STRING,
    notification_type: DataTypes.ENUM('speed', 'ignition', 'geozone', 'idling', 'seatbelt'),
    notification_email: DataTypes.STRING,
    notification_sms: DataTypes.STRING,
    notification_alert: DataTypes.ENUM('1', '0'),
    notification_alert_app: DataTypes.ENUM('1', '0'),
    notification_priority: DataTypes.ENUM('high', 'normal'),
    notification_status: DataTypes.ENUM('active', 'inactive'),
    notification_speed_parameters: DataTypes.ENUM('Is Greater than', 'Is Equal to', 'Is Less than'),
    notification_ignition_parameter: DataTypes.ENUM('on', 'off', 'onandoff', 'Movingwithoutignitionon'),
    notification_speed_parameter_value: DataTypes.STRING,
    notification_speed_is_longer_than: DataTypes.STRING,
    notification_speed_is_longer_than_value: DataTypes.ENUM('Seconds', 'Minutes', 'Hours', 'Kilometers'),
    notification_idling_parameter: DataTypes.STRING,
    notification_time_from: DataTypes.STRING,
    notification_time_to: DataTypes.STRING,
    notification_monday: DataTypes.ENUM('0', '1'),
    notification_tuesday: DataTypes.ENUM('0', '1'),
    notification_wednesday: DataTypes.ENUM('0', '1'),
    notification_thursday: DataTypes.ENUM('0', '1'),
    notification_friday: DataTypes.ENUM('0', '1'),
    notification_saturday: DataTypes.ENUM('0', '1'),
    notification_sunday: DataTypes.ENUM('0', '1'),
    notification_geozone: DataTypes.ENUM('Any where', 'In selected zones', 'Out selected zones'),
    notification_speed_zone_only: DataTypes.BOOLEAN,
  }, {
    tableName: 'tc_tbl_notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

 
module.exports = TblNotifications;