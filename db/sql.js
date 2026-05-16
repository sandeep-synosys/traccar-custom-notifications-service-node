const { Sequelize } = require("sequelize");

const env = process.env.ENV;


const db_host = process.env[`SQL_DB_HOST_${env}`]
const db_name = process.env[`SQL_DB_NAME_${env}`]
const db_user = process.env[`SQL_DB_USERNAME_${env}`]
const db_password = process.env[`SQL_DB_PASSWORD_${env}`]
const db_port = process.env[`SQL_DB_PORT_${env}`]

console.table({
    Host: db_host,
    Database: db_name,
    Port: db_port,
    User: db_user ,
    // Password : db_password
  });
  

const sequelize = new Sequelize(db_name, db_user, db_password, {
  host: db_host,
  port : db_port,
  dialect : "mysql",
  logging : false,
  alter: false,
});

module.exports = sequelize;
