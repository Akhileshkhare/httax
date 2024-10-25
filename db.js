// db.js
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: 'www.httaxsolutions.com',
  user: 'gacciajz_gaccadm',
  password: 'gaccqaz123',
  database: 'gacciajz_httaxdb',
});

module.exports = pool;
