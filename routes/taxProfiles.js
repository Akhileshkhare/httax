const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const authenticateToken = require("../auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
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
    const profileId = req.params.id;
    const profile = req.body;
  
    try {
      // Destructure the profile object to get individual pieces of data
      const { personalInfo, dependents, residencyInfo, bankDetails } = profile;
  
      // Update the personal information
      const updatePersonalInfoQuery = `
        UPDATE htax_profiles SET 
          first_name = ?, middle_name = ?, last_name = ?, street_address = ?, apartment_number = ?, 
          city = ?, state = ?, zip = ?, ssn_or_itin = ?, apply_for_itin = ?, date_of_birth = ?, 
          filing_status = ?
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
        profileId
      ]);
  
      // Update spouse information if available
      if (personalInfo.spouseInfo) {
        const updateSpouseInfoQuery = `
          UPDATE spouses SET
            first_name = ?, middle_name = ?, last_name = ?, date_of_birth = ?, ssn_or_itin = ?, apply_for_itin = ?
          WHERE profile_id = ?;
        `;
        await db.query(updateSpouseInfoQuery, [
          personalInfo.spouseInfo.firstName,
          personalInfo.spouseInfo.middleName,
          personalInfo.spouseInfo.lastName,
          personalInfo.spouseInfo.dateOfBirth,
          personalInfo.spouseInfo.ssnOrItin,
          personalInfo.spouseInfo.applyForITIN,
          profileId
        ]);
      }
  
      // Update or insert dependents (replace all dependents for simplicity)
      await db.query('DELETE FROM dependents WHERE profile_id = ?', [profileId]);
  
      const insertDependentQuery = `
        INSERT INTO dependents (profile_id, first_name, middle_name, last_name, date_of_birth, ssn_or_itin, relationship, apply_for_itin)
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
      await db.query('DELETE FROM residency_info WHERE profile_id = ?', [profileId]);
  
      const insertResidencyQuery = `
        INSERT INTO residency_info (profile_id, state, residency_begin_date, residency_end_date)
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
        WHERE profile_id = ?;
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
      const deleteDependentsQuery = 'DELETE FROM dependents WHERE profile_id = ?';
      await db.query(deleteDependentsQuery, [profileId]);
  
      // Delete residency information associated with the profile
      const deleteResidencyQuery = 'DELETE FROM residency_info WHERE profile_id = ?';
      await db.query(deleteResidencyQuery, [profileId]);
  
      // Delete bank details associated with the profile
      const deleteBankDetailsQuery = 'DELETE FROM bank_details WHERE profile_id = ?';
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
  
module.exports = router;
