// routes/pricing.js
const express = require("express");
const pool = require("../db");
const authenticateToken = require("../auth");

const router = express.Router();

// Create a new pricing entry
router.post("/", authenticateToken, async (req, res) => {
  const { features, individual, business, priority, status, add_date } =
    req.body;

  try {
    await pool.query(
      `INSERT INTO htax_pricing (features, individual, business, priority, status, add_date) VALUES (?, ?, ?, ?, ?, ?)`,
      [features, individual, business, priority, status, add_date]
    );
    res.status(201).json({ message: "Pricing entry created successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get all pricing entries
router.get("/",  async (req, res) => {
  try {
    const [pricing] = await pool.query("SELECT * FROM htax_pricing");
    res.json(pricing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get a single pricing entry by ID
router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [pricing] = await pool.query(
      "SELECT * FROM htax_pricing WHERE id = ?",
      [id]
    );
    if (pricing.length === 0)
      return res.status(404).json({ message: "Pricing entry not found." });

    res.json(pricing[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Update a pricing entry
router.put("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { features, individual, business, priority, status, add_date } =
    req.body;

  try {
    const [result] = await pool.query(
      `UPDATE htax_pricing SET features = ?, individual = ?, business = ?, priority = ?, status = ?, add_date = ? WHERE id = ?`,
      [features, individual, business, priority, status, add_date, id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Pricing entry not found." });

    res.json({ message: "Pricing entry updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Delete a pricing entry
router.delete("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query("DELETE FROM htax_pricing WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Pricing entry not found." });

    res.json({ message: "Pricing entry deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;




