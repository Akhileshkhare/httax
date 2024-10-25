// routes/taxDocumentsSubmitForReview.js
const express = require("express");
const pool = require("../db");
const authenticateToken = require("../auth");

const router = express.Router();

// Create a new document submission for review
router.post("/", authenticateToken, async (req, res) => {
  const { reg_id, submit_date, action_status, review_date } = req.body;

  try {
    await pool.query(
      `INSERT INTO htax_tax_documents_submit_for_review (reg_id, submit_date, action_status, review_date) VALUES (?, ?, ?, ?)`,
      [reg_id, submit_date, action_status, review_date]
    );
    res
      .status(201)
      .json({ message: "Document submitted for review successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get all document submissions for review
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [documents] = await pool.query(
      "SELECT * FROM htax_tax_documents_submit_for_review"
    );
    res.json(documents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get a single document submission for review by ID
router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [document] = await pool.query(
      "SELECT * FROM htax_tax_documents_submit_for_review WHERE id = ?",
      [id]
    );
    if (document.length === 0)
      return res
        .status(404)
        .json({ message: "Document submission not found." });

    res.json(document[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Update a document submission for review
router.put("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { reg_id, submit_date, action_status, review_date } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE htax_tax_documents_submit_for_review 
            SET reg_id = ?, submit_date = ?, action_status = ?, review_date = ? 
            WHERE id = ?`,
      [reg_id, submit_date, action_status, review_date, id]
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "Document submission not found." });

    res.json({ message: "Document submission updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Delete a document submission for review
router.delete("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM htax_tax_documents_submit_for_review WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "Document submission not found." });

    res.json({ message: "Document submission deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
