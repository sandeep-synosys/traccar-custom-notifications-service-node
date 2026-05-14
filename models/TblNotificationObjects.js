const sequelize = require("../db/sql");
const {DataTypes} = require("sequelize")

const TblNotificationObjects = sequelize.define(
  "TblNotificationObjects",
  {
    notification_objects_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    notification_objects_obj_id: DataTypes.INTEGER,
    notification_objects_obj_device_id: DataTypes.STRING, // device uniqueId
    notification_objects_notifn_id: DataTypes.INTEGER,
    notification_objects_status: DataTypes.ENUM("1", "0"),
  },
  {
    tableName: "tc_tbl_notification_objects",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = TblNotificationObjects;