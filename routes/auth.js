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
    const [rows] = await pool.query(
      "SELECT * FROM htax_registrations WHERE email = ?",
      [email]
    );
    console.log('Get Registration : ',rows)

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid email2 or password." });
    }

    const user = rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email2 or password." });
    }

    // Generate JWT
    const token = jwt.sign(
      { reg_id: user.reg_id, email: user.email, operator_id: user.operator_id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

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
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
