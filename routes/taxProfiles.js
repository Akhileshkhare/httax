const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const authenticateToken = require("../auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { sendMail } = require("./mailService");
require("dotenv").config(); // Ensure you have a .env file with JWT_SECRET

const router = express.Router();

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../public/profile");
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const operatorId = req.user ? req.user.id : "unknown"; // Handle cases where req.user might not be available
    const name = req.body.name || "default";
    const ext = path.extname(file.originalname);
    const filename = `${operatorId}-${name}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({ storage });


// -------------------------------------------------------------
router.post('/', authenticateToken, async (req, res) => {
    try {
      const profile = req.body;
      const regId=profile.personalInfo.regID;
      console.log('profile Data : ',regId,profile)
      // Insert into htax_profiles
      const [profileResult] = await db.query(
        `INSERT INTO htax_profiles (reg_id, first_name, middle_name, last_name, street_address, apartment_number, city, state, zip, ssn_or_itin, apply_for_itin, date_of_birth, filing_status, spouse_first_name, spouse_middle_name, spouse_last_name, spouse_dob, spouse_ssn_or_itin, spouse_apply_for_itin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [regId,profile.personalInfo.firstName, profile.personalInfo.middleName, profile.personalInfo.lastName, profile.personalInfo.address.streetAddress, profile.personalInfo.address.apartmentNumber, profile.personalInfo.address.city, profile.personalInfo.address.state, profile.personalInfo.address.zip, profile.personalInfo.ssnOrItin, profile.personalInfo.applyForITIN, profile.personalInfo.dateOfBirth, profile.personalInfo.filingStatus, profile.personalInfo.spouseInfo.firstName, profile.personalInfo.spouseInfo.middleName, profile.personalInfo.spouseInfo.lastName, profile.personalInfo.spouseInfo.dateOfBirth, profile.personalInfo.spouseInfo.ssnOrItin, profile.personalInfo.spouseInfo.applyForITIN]
      );
      
      const taxProfileId = profileResult.insertId;
      console.log('profileResult : ',profileResult)
      // Insert dependents
      for (const dependent of profile.dependents) {
        await db.query(
          `INSERT INTO dependents (tax_profile_id, first_name, middle_name, last_name, date_of_birth, ssn_or_itin, relationship, apply_for_itin)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [taxProfileId, dependent.firstName, dependent.middleName, dependent.lastName, dependent.dateOfBirth, dependent.ssnOrItin, dependent.relationship, dependent.applyForITIN]
        );
      }
  
      // Insert residency info
      for (const residency of profile.residencyInfo) {
        await db.query(
          `INSERT INTO residency_info (tax_profile_id, state, residency_begin_date, residency_end_date)
           VALUES (?, ?, ?, ?)`,
          [taxProfileId, residency.state, residency.residencyBeginDate, residency.residencyEndDate]
        );
      }
  
      // Insert bank details
      await db.query(
        `INSERT INTO bank_details (tax_profile_id, bank_name, account_type, routing_number, account_number)
         VALUES (?, ?, ?, ?, ?)`,
        [taxProfileId, profile.bankDetails.bankName, profile.bankDetails.accountType, profile.bankDetails.routingNumber, profile.bankDetails.accountNumber]
      );
      await db.query(
        `UPDATE htax_registrations
         SET profile_status = 1, tax_profile_id = ?
         WHERE reg_id = ?`,
        [taxProfileId, regId]
      );
      res.status(201).send('Tax profile created successfully, and registration updated.');
    } catch (error) {
      console.error(error);
      res.status(500).send('Server error');
    }
  });
  
  router.put('/:id', authenticateToken, async (req, res) => {
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Request Body:', req.body);
    const profileId = req.params.id;
    const profile = req.body;
  console.log('Profile Data Value : ',profile);
    try {
      // Destructure the profile object to get individual pieces of data
      const { personalInfo, dependents, residencyInfo, bankDetails } = profile;
  
      const updatePersonalInfoQuery = `
      UPDATE htax_profiles SET 
        first_name = ?, 
        middle_name = ?, 
        last_name = ?, 
        street_address = ?, 
        apartment_number = ?, 
        city = ?, 
        state = ?, 
        zip = ?, 
        ssn_or_itin = ?, 
        apply_for_itin = ?, 
        date_of_birth = ?, 
        filing_status = ?, 
        spouse_first_name = ?, 
        spouse_middle_name = ?, 
        spouse_last_name = ?, 
        spouse_dob = ?, 
        spouse_ssn_or_itin = ?, 
        spouse_apply_for_itin = ?
      WHERE id = ?;
    `;

    await db.query(updatePersonalInfoQuery, [
      personalInfo.firstName,
      personalInfo.middleName,
      personalInfo.lastName,
      personalInfo.address.streetAddress,
      personalInfo.address.apartmentNumber,
      personalInfo.address.city,
      personalInfo.address.state,
      personalInfo.address.zip,
      personalInfo.ssnOrItin,
      personalInfo.applyForITIN,
      personalInfo.dateOfBirth,
      personalInfo.filingStatus,
      personalInfo.spouseInfo?.firstName || null,
      personalInfo.spouseInfo?.middleName || null,
      personalInfo.spouseInfo?.lastName || null,
      personalInfo.spouseInfo?.dateOfBirth || null,
      personalInfo.spouseInfo?.ssnOrItin || null,
      personalInfo.spouseInfo?.applyForITIN || null,
      profileId,
    ]);
  
      // Update or insert dependents (replace all dependents for simplicity)
      await db.query('DELETE FROM dependents WHERE tax_profile_id = ?', [profileId]);
  
      const insertDependentQuery = `
        INSERT INTO dependents (tax_profile_id, first_name, middle_name, last_name, date_of_birth, ssn_or_itin, relationship, apply_for_itin)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
      `;
  
      for (let dependent of dependents) {
        await db.query(insertDependentQuery, [
          profileId,
          dependent.firstName,
          dependent.middleName,
          dependent.lastName,
          dependent.dateOfBirth,
          dependent.ssnOrItin,
          dependent.relationship,
          dependent.applyForITIN,
        ]);
      }
  
      // Update or insert residency information (replace all residency info for simplicity)
      await db.query('DELETE FROM residency_info WHERE tax_profile_id = ?', [profileId]);
  
      const insertResidencyQuery = `
        INSERT INTO residency_info (tax_profile_id, state, residency_begin_date, residency_end_date)
        VALUES (?, ?, ?, ?);
      `;
  
      for (let residency of residencyInfo) {
        await db.query(insertResidencyQuery, [
          profileId,
          residency.state,
          residency.residencyBeginDate,
          residency.residencyEndDate,
        ]);
      }
  
      // Update the bank details
      const updateBankDetailsQuery = `
        UPDATE bank_details SET
          bank_name = ?, account_type = ?, routing_number = ?, account_number = ?
        WHERE tax_profile_id = ?;
      `;
  
      await db.query(updateBankDetailsQuery, [
        bankDetails.bankName,
        bankDetails.accountType,
        bankDetails.routingNumber,
        bankDetails.accountNumber,
        profileId,
      ]);
  
      res.send('Tax profile updated successfully');
    } catch (error) {
      console.error('Error updating tax profile:', error);
      res.status(500).send('Server error');
    }
  });
  router.get('/:id', authenticateToken, async (req, res) => {
    try {
      const profileId=req.params.id     
  
      const [profile] = await db.query(
        `SELECT * FROM htax_profiles WHERE id = ?`,
        [profileId]
      );
      // const profileId = profile.id;
      const [dependents] = await db.query(
        `SELECT * FROM dependents WHERE tax_profile_id = ?`,
        [profileId]
      );
  
      const [residencyInfo] = await db.query(
        `SELECT * FROM residency_info WHERE tax_profile_id = ?`,
        [profileId]
      );
  
      const [bankDetails] = await db.query(
        `SELECT * FROM bank_details WHERE tax_profile_id = ?`,
        [profileId]
      );
  
      res.json({
        personalInfo: profile,
        dependents,
        residencyInfo,
        bankDetails,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Server error');
    }
  });
  
  router.delete('/:id', authenticateToken, async (req, res) => {
    const profileId = req.params.id;
  
    try {
      // Start a transaction to ensure all related deletions happen together
      await db.beginTransaction();
  
      // Delete dependents associated with the profile
      const deleteDependentsQuery = 'DELETE FROM dependents WHERE tax_profile_id = ?';
      await db.query(deleteDependentsQuery, [profileId]);
  
      // Delete residency information associated with the profile
      const deleteResidencyQuery = 'DELETE FROM residency_info WHERE tax_profile_id = ?';
      await db.query(deleteResidencyQuery, [profileId]);
  
      // Delete bank details associated with the profile
      const deleteBankDetailsQuery = 'DELETE FROM bank_details WHERE tax_profile_id = ?';
      await db.query(deleteBankDetailsQuery, [profileId]);
  
      // Finally, delete the tax profile itself
      const deleteProfileQuery = 'DELETE FROM htax_profiles WHERE id = ?';
      await db.query(deleteProfileQuery, [profileId]);
  
      // Commit the transaction after all deletions are successful
      await db.commit();
  
      res.send('Tax profile deleted successfully');
    } catch (error) {
      console.error('Error deleting tax profile:', error);
  
      // If an error occurs, roll back the transaction
      await db.rollback();
  
      res.status(500).send('Server error');
    }
  });
  router.delete('/dependents/:id', (req, res) => {
    const dependentId = req.params.id;
    if (!dependentId) {
      return res.status(400).json({ error: "Dependent ID is required." });
    }
    // SQL query to delete a record
    const query = `DELETE FROM dependents WHERE id = ?`;

    db.query(query, [dependentId], (err, result) => {
        if (err) {
            console.error('Error deleting dependent:', err);
            return res.status(500).json({ message: 'Failed to delete dependent', error: err });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Dependent not found' });
        }

        res.status(200).json({ message: 'Dependent deleted successfully', id: dependentId });
    });
});
router.delete("/residency-info/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Residency info ID is required." });
  }

  try {
    // Delete the residency entry
    const deleteQuery = "DELETE FROM residency_info WHERE id = ?";
    await db.execute(deleteQuery, [id]);

    return res.status(200).json({ message: "Residency info deleted successfully." });
  } catch (error) {
    console.error("Error deleting residency info:", error);
    return res.status(500).json({ error: "Internal Server Error." });
  }
});
  // POST /generate-otp
router.post('/generate-otp', authenticateToken, async (req, res) => {
  try {
    const { reg_id } = req.body;
console.log('Reg ID',reg_id)
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry time (5 minutes from now)
    const expiryTime = Date.now() + 5 * 60 * 1000;

    // Update the OTP and expiry in the database
    await db.query(
      'UPDATE htax_profiles SET profile_update_otp = ?, otp_expiry = ? WHERE id = ?',
      [otp, expiryTime, reg_id]
    );

    // Retrieve the user's regId using id
    const [userReg] = await db.query('SELECT reg_id FROM htax_profiles WHERE id = ?', [reg_id]);
    if (!userReg.length) {
      return res.status(404).send('User not found.');
    }

    const regId = userReg[0].reg_id;
    // Retrieve the user's email using reg_id
    const [user] = await db.query('SELECT email,first_name, last_name  FROM htax_registrations WHERE reg_id = ?', [regId]);
    if (!user.length) {
      return res.status(404).send('User not found.');
    }

    const email = user[0].email;
    const userName = `${user[0].first_name} ${user[0].last_name}`;

    // Send the OTP to the user's email
    const text = `Hello ${userName},

    Your OTP is ${otp}. It is valid for 5 minutes.
    
    Best regards,
    HTTax Solutions`;

    await sendMail(email,'Your OTP for Profile Update',text);

    res.status(200).send('OTP sent successfully.');
  } catch (error) {
    console.error('Error generating OTP:', error);
    res.status(500).send('Error generating or sending OTP.');
  }
});
// POST /verify-otp
router.post('/verify-otp', authenticateToken, async (req, res) => {
  try {
    const { reg_id, otp } = req.body;

    // Validate inputs
    if (!reg_id || !/^\d{6}$/.test(otp)) {
      return res.status(400).send('Invalid input.');
    }

    // Retrieve OTP and expiry details
    const [rows] = await db.query(
      'SELECT profile_update_otp, otp_expiry FROM htax_profiles WHERE id = ?',
      [reg_id]
    );

    if (rows.length === 0) {
      return res.status(404).send('User not found.');
    }

    const { profile_update_otp, otp_expiry } = rows[0];

    // Validate OTP
    if (parseInt(profile_update_otp, 10) !== parseInt(otp, 10)) {
      return res.status(400).send('Invalid OTP.');
    }

    // Check OTP expiry
    if (Date.now() > new Date(otp_expiry).getTime()) {
      return res.status(400).send('OTP has expired.');
    }

    // OTP is valid; clear it from the database
    await db.query(
      'UPDATE htax_profiles SET profile_update_otp = NULL, otp_expiry = NULL WHERE id = ?',
      [reg_id]
    );

    res.status(200).send('OTP verified successfully.');
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).send('Error verifying OTP.');
  }
});


module.exports = router;
