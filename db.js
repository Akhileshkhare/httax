// db.js
const mysql = require("mysql2/promise");
require("dotenv").config();

const isProduction = process.env.NODE_ENV === 'production';

const pool = mysql.createPool({
  host: isProduction ? process.env.DB_HOST_PROD : process.env.DB_HOST_DEV,
  user: isProduction ? process.env.DB_USER_PROD : process.env.DB_USER_DEV,
  password: isProduction ? process.env.DB_PASS_PROD : process.env.DB_PASS_DEV,
  database: isProduction ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV,
  port: 3306,
  connectionLimit: 10,
});

// Test the connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Connection to the database was successful!');
    // Run a simple test query
    connection.query('SELECT 1 + 1 AS solution', (error, results) => {
      connection.release(); // Release the connection back to the pool
      if (error) {
        console.error('Error executing query:', error);
      } else {
        console.log('Test query result:', results[0].solution); // Should output "2"
      }
    });
  }
});

module.exports = pool;
