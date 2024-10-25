// routes/api.js
const express = require("express");
const authenticateToken = require("../auth");
const pool = require("../db");

const router = express.Router();

router.get("/categories", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM htax_category");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// Define more routes for other tables as needed...

module.exports = router;
