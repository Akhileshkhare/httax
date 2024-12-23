// routes/taxDocuments.js
const express = require("express");
const pool = require("../db");
const authenticateToken = require("../auth");

const router = express.Router();


router.get('/document/:reg_id', authenticateToken, async (req, res) => {
  const { reg_id } = req.params;

  try {
    const [documents] = await pool.query(
      'SELECT id, title, document_name FROM htax_tax_documents WHERE reg_id = ? AND status = "active"',
      [reg_id]
    );

    if (documents.length === 0) {
      return res.status(404).json({ message: 'No documents found for this user' });
    }

    res.status(200).json(documents);
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a new tax document entry
router.post("/", authenticateToken, async (req, res) => {
  const {
    reg_id,
    title,
    document_name,
    file_type,
    operator_review_status,
    operator_review_date,
    manager_review_status,
    manager_review_date,
    upload_date,
    status,
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO htax_tax_documents 
            (reg_id, title, document_name, file_type, operator_review_status, operator_review_date, manager_review_status, manager_review_date, upload_date, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reg_id,
        title,
        document_name,
        file_type,
        operator_review_status,
        operator_review_date,
        manager_review_status,
        manager_review_date,
        upload_date,
        status,
      ]
    );
    res.status(201).json({ message: "Tax document created successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});


// Get a single tax document entry by ID
router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [document] = await pool.query(
      "SELECT * FROM htax_tax_documents WHERE id = ?",
      [id]
    );
    if (document.length === 0)
      return res.status(404).json({ message: "Tax document not found." });

    res.json(document[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Update a tax document entry
router.put("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    reg_id,
    title,
    document_name,
    file_type,
    operator_review_status,
    operator_review_date,
    manager_review_status,
    manager_review_date,
    upload_date,
    status,
  } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE htax_tax_documents 
            SET reg_id = ?, title = ?, document_name = ?, file_type = ?, operator_review_status = ?, operator_review_date = ?, manager_review_status = ?, manager_review_date = ?, upload_date = ?, status = ? 
            WHERE id = ?`,
      [
        reg_id,
        title,
        document_name,
        file_type,
        operator_review_status,
        operator_review_date,
        manager_review_status,
        manager_review_date,
        upload_date,
        status,
        id,
      ]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Tax document not found." });

    res.json({ message: "Tax document updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Delete a tax document entry
router.delete("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM htax_tax_documents WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Tax document not found." });

    res.json({ message: "Tax document deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
