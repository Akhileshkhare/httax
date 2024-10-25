// routes/taxDocumentsPreparePaymentDetails.js
const express = require("express");
const pool = require("../db");
const authenticateToken = require("../auth");

const router = express.Router();

// Create a new payment detail entry
router.post("/", authenticateToken, async (req, res) => {
  const {
    tax_documents_prepare_id,
    payer_email,
    payer_id,
    payer_status,
    payer_first_name,
    payer_last_name,
    txn_id,
    txn_type,
    mc_currency,
    payment_gross,
    payment_status,
    payment_type,
    payment_date,
    business,
    pay_date,
    pay_time,
    ip_address,
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO htax_tax_documents_prepare_payment_details 
            (tax_documents_prepare_id, payer_email, payer_id, payer_status, payer_first_name, payer_last_name, txn_id, txn_type, mc_currency, payment_gross, payment_status, payment_type, payment_date, business, pay_date, pay_time, ip_address) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tax_documents_prepare_id,
        payer_email,
        payer_id,
        payer_status,
        payer_first_name,
        payer_last_name,
        txn_id,
        txn_type,
        mc_currency,
        payment_gross,
        payment_status,
        payment_type,
        payment_date,
        business,
        pay_date,
        pay_time,
        ip_address,
      ]
    );
    res
      .status(201)
      .json({ message: "Payment detail entry created successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get all payment detail entries
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [paymentDetails] = await pool.query(
      "SELECT * FROM htax_tax_documents_prepare_payment_details"
    );
    res.json(paymentDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get a single payment detail entry by ID
router.get("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [paymentDetail] = await pool.query(
      "SELECT * FROM htax_tax_documents_prepare_payment_details WHERE id = ?",
      [id]
    );
    if (paymentDetail.length === 0)
      return res
        .status(404)
        .json({ message: "Payment detail entry not found." });

    res.json(paymentDetail[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Update a payment detail entry
router.put("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    tax_documents_prepare_id,
    payer_email,
    payer_id,
    payer_status,
    payer_first_name,
    payer_last_name,
    txn_id,
    txn_type,
    mc_currency,
    payment_gross,
    payment_status,
    payment_type,
    payment_date,
    business,
    pay_date,
    pay_time,
    ip_address,
  } = req.body;

  try {
    const [result] = await pool.query(
      `UPDATE htax_tax_documents_prepare_payment_details 
            SET tax_documents_prepare_id = ?, payer_email = ?, payer_id = ?, payer_status = ?, payer_first_name = ?, payer_last_name = ?, txn_id = ?, txn_type = ?, mc_currency = ?, payment_gross = ?, payment_status = ?, payment_type = ?, payment_date = ?, business = ?, pay_date = ?, pay_time = ?, ip_address = ? 
            WHERE id = ?`,
      [
        tax_documents_prepare_id,
        payer_email,
        payer_id,
        payer_status,
        payer_first_name,
        payer_last_name,
        txn_id,
        txn_type,
        mc_currency,
        payment_gross,
        payment_status,
        payment_type,
        payment_date,
        business,
        pay_date,
        pay_time,
        ip_address,
        id,
      ]
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "Payment detail entry not found." });

    res.json({ message: "Payment detail entry updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Delete a payment detail entry
router.delete("/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM htax_tax_documents_prepare_payment_details WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "Payment detail entry not found." });

    res.json({ message: "Payment detail entry deleted successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
