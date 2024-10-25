// routes/operatorAssignUsers.js
const express = require("express");
const pool = require("../db");
const authenticateToken = require("../auth");

const router = express.Router();

// Create Assignment
router.post("/", authenticateToken, async (req, res) => {
  const { operator_id, reg_id, assign_date } = req.body;

  try {
    await pool.query(
      `INSERT INTO htax_operator_assign_users (operator_id, reg_id, assign_date) VALUES (?, ?, ?)`,
      [operator_id, reg_id, assign_date]
    );

    res.status(201).json({ message: "Assignment created successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get All Assignments
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [assignments] = await pool.query(
      "SELECT * FROM htax_operator_assign_users"
    );
    res.json(assignments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get Assignments by Operator ID
router.get("/operator/:operator_id", authenticateToken, async (req, res) => {
  const { operator_id } = req.params;

  try {
    const [assignments] = await pool.query(
      "SELECT * FROM htax_operator_assign_users WHERE operator_id = ?",
      [operator_id]
    );
    res.json(assignments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get Assignments by Registration ID
router.get("/registration/:reg_id", authenticateToken, async (req, res) => {
  const { reg_id } = req.params;

  try {
    const [assignments] = await pool.query(
      "SELECT * FROM htax_operator_assign_users WHERE reg_id = ?",
      [reg_id]
    );
    res.json(assignments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Update Assignment
router.put("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { operator_id, reg_id, assign_date } = req.body;

  try {
    await pool.query(
      `UPDATE htax_operator_assign_users SET operator_id = ?, reg_id = ?, assign_date = ? WHERE id = ?`,
      [operator_id, reg_id, assign_date, id]
    );

    res.json({ message: "Assignment updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Delete Assignment
router.delete("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM htax_operator_assign_users WHERE id = ?", [
      id,
    ]);
    res.json({ message: "Assignment deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
