const mongoose = require("mongoose");

// ==== TEST
mongoose.connect('mongodb+srv://betMyLocator_test:cxt3eOVKIumNeI79@cluster0.u2knh68.mongodb.net/Task_Manager?retryWrites=true&w=majority&appName=Cluster0');

// ==== PRODUCTION
// mongoose.connect("mongodb://85.195.73.163:27017/26_10_2021_Task_Manager", {
//   useUnifiedTopology: true,
//   user: "betaMyLocator",
//   pass: "mylocator@DBMaster1010",
// });
// mongoose.set('debug',true)
const db = mongoose.connection;

db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("DATABASE CONNECTED");
});