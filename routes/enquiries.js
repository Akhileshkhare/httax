// routes/enquiries.js
const express = require("express");
const pool = require("../db"); // Make sure to create a pool in db.js
const authenticateToken = require("../auth"); // Assuming you have a JWT authentication middleware

const router = express.Router();

// Helper function to get client's IP address
function getClientIp(req) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;
  return ip.split(",")[0]; // Handles multiple IPs in case of proxies
}

// Create a new enquiry
router.post("/", async (req, res) => {
  const { name, email, phone_no, comment_message } = req.body;

  try {
    const ip_address = getClientIp(req); // Get the client IP address
    const currentDate = new Date();
    const [result] = await pool.query(
      `INSERT INTO htax_enquiry (
        name, email, phone_no, comment_message, reg_date, reg_time, ip_address
      ) VALUES (?, ?, ?, ?, CURDATE(), CURTIME(), ?)`,
      [name, email, phone_no, comment_message, ip_address]
    );

    res.status(201).json({
      message: "Enquiry created successfully.",
      id: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// Get all enquiries
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM htax_enquiry");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// Get enquiry by ID
router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query("SELECT * FROM htax_enquiry WHERE id = ?", [
      id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Enquiry not found." });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// Update an enquiry by ID
router.put("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone_no, comment_message, ip_address } = req.body;

  try {
    const updates = [];
    const params = [];

    if (name) {
      updates.push("name = ?");
      params.push(name);
    }
    if (email) {
      updates.push("email = ?");
      params.push(email);
    }
    if (phone_no) {
      updates.push("phone_no = ?");
      params.push(phone_no);
    }
    if (comment_message) {
      updates.push("comment_message = ?");
      params.push(comment_message);
    }
    if (ip_address) {
      updates.push("ip_address = ?");
      params.push(ip_address);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No fields to update." });
    }

    params.push(id);
    const query = `UPDATE htax_enquiry SET ${updates.join(", ")} WHERE id = ?`;
    await pool.query(query, params);

    res.json({ message: "Enquiry updated successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// Delete an enquiry by ID
router.delete("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM htax_enquiry WHERE id = ?", [id]);
    res.json({ message: "Enquiry deleted successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
