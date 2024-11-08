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
  
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error("JWT_SECRET is not defined.");
      return res.status(500).json({ error: "JWT_SECRET is not defined." });
    }
    
    const token = jwt.sign(
      { reg_id: user.reg_id, email: user.email, operator_id: user.operator_id },
      jwtSecret,
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
        user_type:'Client'
      },
    });
  } catch (error) {
    console.error("Error in /login route:", error);
    res.status(500).json({ error: "Internal server error." });
  }
  
});
// Token validation endpoint
router.get("/validate-token", (req, res) => {
  // Extract token from the Authorization header
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  // Verify the token
  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) {
      if (error instanceof jwt.TokenExpiredError) {
        // Handle token expiration
        return res.status(401).json({ message: "Token has expired." });
      } else if (error instanceof jwt.JsonWebTokenError) {
        // Handle invalid token
        return res.status(400).json({ message: "Invalid token." });
      } else {
        // Handle other verification errors
        return res.status(400).json({ message: "Authentication error." });
      }
    }

    // Token is valid
    res.status(200).json({ message: "Token is valid.", user: decoded });
  });
});


module.exports = router;
