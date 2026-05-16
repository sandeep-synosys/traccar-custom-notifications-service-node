const mongoose = require("mongoose")

const Schema = mongoose.Schema;

const UsersSchema = new Schema({
  organization: {
    type: String,
    required: true,
  },
  user_id: {
    type: String,
    required: true,
  },
  user_partner_id: {
    type: String,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    default: "",
  },
  type: {
    type: String,
    default: "",
  },
  profile: {
    type: String,
    default: "",
  },
  totalUsedStorage: {
    type: Number,
    default: 0,
  },
  token: {
    type: String,
    default: "",
  },
  deviceToken: {
    type: [String],
    default: [],
  },
  appDeviceToken: {
    type: [String],
    default: [],
  },
  status: {
    type: String,
    default: "",
  },
  // for tracking pwd change : force logout functionality
  passwordVersion : {
    type : Number,
    default : 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const UsersModel = mongoose.model("Users", UsersSchema);

module.exports = UsersModel;
