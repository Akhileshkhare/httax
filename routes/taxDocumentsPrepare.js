// routes/taxDocumentsPrepare.js
const express = require("express");
const pool = require("../db");
const authenticateToken = require("../auth");

const router = express.Router();

// Create a new tax document prepare entry
router.post("/", authenticateToken, async (req, res) => {
  const {
    encrypt_reg_id,
    operator_id,
    manager_id,
    title,
    file_name,
    file_type,
    invoice_title,
    invoice_file_name,
    invoice_file_type,
    upload_date,
    manager_status,
    manager_action_perform_date,
    send_to_client_status,
    send_to_client_date,
    payment_amount,
    payment_status,
    status,
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO htax_tax_documents_prepare 
            (encrypt_reg_id, operator_id, manager_id, title, file_name, file_type, invoice_title, invoice_file_name, invoice_file_type, upload_date, manager_status, manager_action_perform_date, send_to_client_status, send_to_client_date, payment_amount, payment_status, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        encrypt_reg_id,
        operator_id,
        manager_id,
        title,
        file_name,
        file_type,
        invoice_title,
        invoice_file_name,
        invoice_file_type,
        upload_date,
        manager_status,
        manager_action_perform_date,
        send_to_client_status,
        send_to_client_date,
        payment_amount,
        payment_status,
        status,
      ]
    );
    res
      .status(201)
      .json({ message: "Tax document prepare entry created successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get all tax document prepare entries
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [documents] = await pool.query(
      "SELECT * FROM htax_tax_documents_prepare"
    );
    res.json(documents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get a single tax document prepare entry by ID
router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [document] = await pool.query(
      "SELECT * FROM htax_tax_documents_prepare WHERE id = ?",
      [id]
    );
    if (document.length === 0)
      return res
        .status(404)
        .json({ message: "Tax document prepare entry not found." });

    res.json(document[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Update a tax document prepare entry
router.put("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    encrypt_reg_id,
    operator_id,
    manager_id,
    title,
    file_name,
    file_type,
    invoice_title,
    invoice_file_name,
    invoice_file_type,
    upload_date,
    manager_status,
    manager_action_perform_date,
    send_to_client_status,
    send_to_client_date,
    payment_amount,
    payment_status,
    status,
  } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE htax_tax_documents_prepare 
            SET encrypt_reg_id = ?, operator_id = ?, manager_id = ?, title = ?, file_name = ?, file_type = ?, invoice_title = ?, invoice_file_name = ?, invoice_file_type = ?, upload_date = ?, manager_status = ?, manager_action_perform_date = ?, send_to_client_status = ?, send_to_client_date = ?, payment_amount = ?, payment_status = ?, status = ? 
            WHERE id = ?`,
      [
        encrypt_reg_id,
        operator_id,
        manager_id,
        title,
        file_name,
        file_type,
        invoice_title,
        invoice_file_name,
        invoice_file_type,
        upload_date,
        manager_status,
        manager_action_perform_date,
        send_to_client_status,
        send_to_client_date,
        payment_amount,
        payment_status,
        status,
        id,
      ]
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "Tax document prepare entry not found." });

    res.json({ message: "Tax document prepare entry updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Delete a tax document prepare entry
router.delete("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM htax_tax_documents_prepare WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "Tax document prepare entry not found." });

    res.json({ message: "Tax document prepare entry deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
