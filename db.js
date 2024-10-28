// db.js
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: 'www.httaxsolutions.com',
  user: 'gacciajz_gaccadm',
  password: 'gaccqaz123',
  database: 'gacciajz_httaxdb',
  port: 3306, // specify port if different
  connectionLimit: 10, // optional: set connection pool limit
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
