// routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("../db");

const router = express.Router();

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query("SELECT * FROM htax_registrations WHERE email = ?", [email]);
    console.log('Get Registration:', rows); // Check what rows is returned
  
    if (rows.length === 0) {
      console.error("Email not found");
      return res.status(401).json({ error: "Invalid email or password." });
    }
  
    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
  
    console.log('Password Match:', passwordMatch); // Ensure it's true/false
  
    if (!passwordMatch) {
      console.error("Password does not match");
      return res.status(401).json({ error: "Invalid email or password." });
    }
  
    const token = jwt.sign(
      { reg_id: user.reg_id, email: user.email, operator_id: user.operator_id },
      process?.env?.JWT_SECRET,
      { expiresIn: "1h" }
    );
  
    console.log("Generated JWT token:", token);
  
    res.json({
      token,
      user: {
        reg_id: user.reg_id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    });
  } catch (error) {
    console.error("Error in /login route:", error);
    res.status(500).json({ error: "Internal server error." });
  }
  
});

module.exports = router;
