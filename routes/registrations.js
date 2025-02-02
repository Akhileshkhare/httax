// routes/registrations.js
const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const authenticateToken = require("../auth");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { sendMail } = require("./mailService");
const { S3Client, ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
require("dotenv").config(); // Ensure you have a .env file with JWT_SECRET

const s3Client = new S3Client({ region: process.env.AWS_REGION });

function generateVerificationCode() {
  return crypto.randomBytes(20).toString("hex"); // Generate a random hexadecimal string
}

const router = express.Router();
// Helper function to get client's IP address
function getClientIp(req) {
  // Use x-forwarded-for header for client IP in case of proxies
  const forwardedIpsStr = req.headers["x-forwarded-for"];
  console.log("Forwarded IPs: ", forwardedIpsStr);
  if (forwardedIpsStr) {
    // Handle multiple IPs in case of proxies (use the first one)
    const forwardedIps = forwardedIpsStr.split(",");
    return forwardedIps[0].trim();
  }

  // Fallback to remoteAddress from the socket if no proxy is used
  const remoteAddress = req.socket.remoteAddress;
  if (remoteAddress && remoteAddress !== "::1") {  // Exclude IPv6 loopback address
    console.log("Remote Address: ", remoteAddress);
    return remoteAddress;
  }

  return null;  // Return null if IP is not found
}


// Route to handle email verification link
router.post('/verify/:token', async (req, res) => {
  const { token } = req.params;

  try {
    // Look up the user by the token
    const [rows] = await pool.query(
      `SELECT * FROM htax_registrations WHERE email_verification_token = ?`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid verification link" });
    }

    // Update the email_verification status to 1
    await pool.query(
      `UPDATE htax_registrations SET email_verification = 1, email_verification_token='' WHERE email_verification_token = ?`,
      [token]
    );

    res.json({ message: "Email verified successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all registrations
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM htax_registrations");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// Get registration by reg_id
router.get("/:reg_id", authenticateToken, async (req, res) => {
  const { reg_id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM htax_registrations WHERE reg_id = ?",
      [reg_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Registration not found." });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// Register a new user
router.post("/", async (req, res) => {
  let {
    first_name,
    middle_name,
    last_name,
    email,
    password,
    phone_no,
    wife_name,
    no_of_children,
  } = req.body;
  const ip_address = getClientIp(req); // Get the client IP address
  const status = 1;
  const document_status = 0;
  const temp_forget = "";
  const expire_temp_forget_link = "";
  const image = "";
  try {
    // Check if the user already exists
    const [existingUser] = await pool.query(
      "SELECT * FROM htax_registrations WHERE email = ?",
      [email]
    );
    if (existingUser.length > 0) {
      console.log('USer Data : ',existingUser);
      return res.status(409).json({ error: "User already exists." });
    }
    console.log("Signup Data : ", req.body, ip_address);

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationCode = generateVerificationCode();
    if (!no_of_children) {
      no_of_children = 0;
    }
    // Insert new user
    const [result] = await pool.query(
      `INSERT INTO htax_registrations (
                operator_id, first_name, middle_name, last_name,
                email, password, phone_no, image, wife_name,
                no_of_children, reg_date, reg_time, ip_address,
                email_verification, status, temp_forget, expire_temp_forget_link, document_status,email_verification_token 
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?,?)`,
      [
        0,
        first_name,
        middle_name,
        last_name,
        email,
        hashedPassword,
        phone_no,
        image,
        wife_name,
        no_of_children,
        ip_address,
        0,
        status,
        temp_forget,
        expire_temp_forget_link,
        document_status,
        verificationCode,
      ]
    );

    res.status(201).json({
      message: "User registered successfully.",
      reg_id: result.insertId,
    });
    // Send verification email
    const mailOptions = {    
      to: email,
      subject: "Please verify your HTTaxSolutions account",
      text: `Hi ${first_name} ${last_name},\n\nPlease click the link below to verify your email address and activate your account. This link will remain active for 24 hrs.\n\n${process.env.NODE_ENV==='production'?process.env.MAIL_URL_PROD:process.env.BASE_URL_DEV}verify/${verificationCode}\n\nBest Regards,\n\nHTTaxSolutions`,
    };
    

    await sendMail(mailOptions.to,mailOptions.subject,mailOptions.text);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error." });
  }
});


// Update registration by reg_id
router.put("/:reg_id", authenticateToken, async (req, res) => {
  const { reg_id } = req.params;
  const {
    operator_id,
    first_name,
    middle_name,
    last_name,
    email,
    password,
    phone_no,
    image,
    wife_name,
    no_of_children,
    ip_address,
    email_verification,
    status,
    temp_forget,
    expire_temp_forget_link,
    document_status,
  } = req.body;

  try {
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const updates = [];
    const params = [];

    if (operator_id) {
      updates.push("operator_id = ?");
      params.push(operator_id);
    }
    if (first_name) {
      updates.push("first_name = ?");
      params.push(first_name);
    }
    if (middle_name) {
      updates.push("middle_name = ?");
      params.push(middle_name);
    }
    if (last_name) {
      updates.push("last_name = ?");
      params.push(last_name);
    }
    if (email) {
      updates.push("email = ?");
      params.push(email);
    }
    if (hashedPassword) {
      updates.push("password = ?");
      params.push(hashedPassword);
    }
    if (phone_no) {
      updates.push("phone_no = ?");
      params.push(phone_no);
    }
    if (image) {
      updates.push("image = ?");
      params.push(image);
    }
    if (wife_name) {
      updates.push("wife_name = ?");
      params.push(wife_name);
    }
    if (no_of_children) {
      updates.push("no_of_children = ?");
      params.push(no_of_children);
    }
    if (ip_address) {
      updates.push("ip_address = ?");
      params.push(ip_address);
    }
    if (email_verification) {
      updates.push("email_verification = ?");
      params.push(email_verification);
    }
    if (status) {
      updates.push("status = ?");
      params.push(status);
    }
    if (temp_forget) {
      updates.push("temp_forget = ?");
      params.push(temp_forget);
    }
    if (expire_temp_forget_link) {
      updates.push("expire_temp_forget_link = ?");
      params.push(expire_temp_forget_link);
    }
    if (document_status) {
      updates.push("document_status = ?");
      params.push(document_status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No fields to update." });
    }

    params.push(reg_id);
    const query = `UPDATE htax_registrations SET ${updates.join(
      ", "
    )} WHERE reg_id = ?`;
    await pool.query(query, params);

    res.json({ message: "Registration updated successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});

// Delete registration by reg_id
router.delete("/:reg_id", authenticateToken, async (req, res) => {
  const { reg_id } = req.params;

  try {
    await pool.query("DELETE FROM htax_registrations WHERE reg_id = ?", [
      reg_id,
    ]);
    res.json({ message: "Registration deleted successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
});
// Add this route to your existing routes/registrations.js file

// Update operator_id for a specific registration by reg_id
router.put("/:reg_id/operator/:operator_id", authenticateToken, async (req, res) => {
  const { reg_id, operator_id } = req.params;

  console.log('operator_id:', operator_id,reg_id); // Log to see if it's received correctly

  try {
    // Ensure operator_id is provided
    if (!operator_id) {
      return res.status(400).json({ message: "operator_id is required." });
    }

    // Update the operator_id
    await pool.query(
      "UPDATE htax_registrations SET operator_id = ? WHERE reg_id = ?",
      [operator_id, reg_id]
    );
    if(parseInt(operator_id)===0){
      res.json({ message: "Operator unassigned successfully!" });
    }else{
 // Fetch operator details from the htax_operator table
 const [operatorResult] = await pool.query(
  "SELECT operator_email, operator_name FROM htax_operator WHERE operator_id = ?",
  [operator_id]
);

if (operatorResult.length === 0) {
  return res.status(404).json({ message: "Operator not found" });
}

const operatorEmail = operatorResult[0].operator_email;
const operatorName = operatorResult[0].operator_name;

// Fetch user details for the notification message
const [userResult] = await pool.query(
  "SELECT first_name, last_name FROM htax_registrations WHERE reg_id = ?",
  [reg_id]
);

if (userResult.length === 0) {
  return res.status(404).json({ message: "User not found" });
}

const userName = `${userResult[0].first_name} ${userResult[0].last_name}`;

// Send email notification to the assigned operator
const subject = "New User Assigned to You";
const text = `Hello ${operatorName},

You have been assigned a new user: ${userName} (Registration ID: ${reg_id}). Please check the platform for further details.

Best regards,
HTTax Solutions`;

await sendMail(operatorEmail, subject, text);

res.json({ message: "Operator updated and notification sent successfully!" });
}
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.put("/update-status/:reg_id/:newStatus", authenticateToken, async (req, res) => {
  const { reg_id, newStatus } = req.params;

  console.log('Updating status:', reg_id, newStatus); // Log to see if values are received correctly

  try {
    // Ensure newStatus is provided
    if (!newStatus) {
      return res.status(400).json({ message: "New status is required." });
    }

    // Update the user status
    await pool.query(
      "UPDATE htax_registrations SET user_status = ? WHERE reg_id = ?",
      [newStatus, reg_id]
    );

// Fetch user details for sending email notifications
const [userResult] = await pool.query(
  "SELECT first_name, last_name, email, operator_id FROM htax_registrations WHERE reg_id = ?",
  [reg_id]
);

if (userResult.length === 0) {
  return res.status(404).json({ message: "User not found" });
}

const userEmail = userResult[0].email;
const userName = `${userResult[0].first_name} ${userResult[0].last_name}`;
const operatorId = userResult[0].operator_id;

// Define messages based on new status
if (newStatus === '0') {
  // Notify user when status changes to "pending"
  const subject = "Status Update: Pending";
  const text = `Dear ${userName},

Your account documents status has been changed to "Pending". Please log in to review your information.

Best regards,
HTTaxSolutions Team`;

  await sendMail(userEmail, subject, text);
}

// Notify admin when status changes to "ManagerReview"
if (newStatus === '2') {
  const [adminResult] = await pool.query(
    "SELECT email FROM htax_admin_login WHERE admin_type = 'Admin'"
  );

  if (adminResult.length > 0) {
    const adminEmail = adminResult[0].email;
    const subject = "Status Update: Manager Review";
    const text = `Admin,

The user ${userName} (Registration ID: ${reg_id}) is now under Manager Review. Please review their account as soon as possible.

Thank you,
HTTaxSolutions Team`;

    await sendMail(adminEmail, subject, text);
  }
}

// Notify the operator if status changes to "SubmittedForReview" and an operator is assigned
if (newStatus === '1' && operatorId !== 0) {
  const [operatorResult] = await pool.query(
    "SELECT operator_email FROM htax_operator WHERE operator_id = ?",
    [operatorId]
  );

  if (operatorResult.length > 0) {
    const operatorEmail = operatorResult[0].operator_email;
    const subject = "Status Update: Submitted For Review";
    const text = `Dear Operator,

      The user ${userName} (Registration ID: ${reg_id}) has been submitted for your review. Please check the platform for further details.

      Thank you,
      HTTaxSolutions Team`;

          await sendMail(operatorEmail, subject, text);
        }
        

        const subject = "Submitting your documents for tax preparation";
        const text = `Dear ${userName},
      
    Thank you for Submitting your documents for tax preparation. We will get provide you a draft of your tax return within next 24-48 hours. We will contact you if any additional document/information is required for your tax preparation. 

    Thank you for giving us an opportunity to serve you. 
    HTTaxSolutions Team`;
      
        await sendMail(userEmail, subject, text);

      }else if (newStatus === '1' && operatorId === 0){
        const [adminResult] = await pool.query(
          "SELECT email FROM htax_admin_login WHERE admin_type = 'Admin'"
        );
      
        if (adminResult.length > 0) {
          const adminEmail = adminResult[0].email;
          const subject = "Status Update: Manager Review";
          const text = `Admin,
      
      The user ${userName} (Registration ID: ${reg_id}) is now under Manager Review. Please review their account as soon as possible.
      
      Thank you,
      HTTaxSolutions Team`;
      
          await sendMail(adminEmail, subject, text);
        }
        const subject = "Submitting your documents for tax preparation";
        const text = `Dear ${userName},
      
    Thank you for Submitting your documents for tax preparation. We will get provide you a draft of your tax return within next 24-48 hours. We will contact you if any additional document/information is required for your tax preparation. 

    Thank you for giving us an opportunity to serve you. 
    HTTaxSolutions Team`;
      
        await sendMail(userEmail, subject, text);
      }

       // Check if the new status is '4' (Payment Complete)
    if (newStatus === '4') {
      // Send 'Thank You' email to the user
      const subject = "Thank You for Your Payment";
      const text = `Dear ${userName},

Thank you for your payment. We appreciate your promptness.

Best regards,
HTTaxSolutions Team`;

      await sendMail(userEmail, subject, text);

      // // Move user's documents to the archive folder in S3
      // const currentYear = new Date().getFullYear().toString();
      // const username = `${userResult[0].first_name}_${userResult[0].last_name}`;
      // const sourcePrefix = `documents/${currentYear}/${username}_${reg_id}/`;
      // const archivePrefix = `archive/${currentYear}/${username}_${reg_id}/`;

      // // List all objects in the user's document folder
      // const listParams = {
      //   Bucket: process.env.S3_BUCKET_NAME,
      //   Prefix: sourcePrefix
      // };

      // const listedObjects = await s3Client.send(new ListObjectsV2Command(listParams));
      // console.log('List of Obj : ',listedObjects);
      // if (listedObjects.Contents.length === 0) {
      //   return res.status(404).json({ message: "No documents found to archive." });
      // }

      // // Copy each object to the archive folder
      // for (const object of listedObjects.Contents) {
      //   const copyParams = {
      //     Bucket: process.env.S3_BUCKET_NAME,
      //     CopySource: `${process.env.S3_BUCKET_NAME}/${object.Key}`,
      //     Key: object.Key.replace(sourcePrefix, archivePrefix)
      //   };
      //   await s3Client.send(new CopyObjectCommand(copyParams));
      // }

      // // Delete original objects after copying
      // for (const object of listedObjects.Contents) {
      //   const deleteParams = {
      //     Bucket: process.env.S3_BUCKET_NAME,
      //     Key: object.Key
      //   };
      //   await s3Client.send(new DeleteObjectCommand(deleteParams));
      // }
    }

      res.json({ message: "User status updated successfully and notifications sent!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Send bulk emails to filtered users
router.post("/send-emails", authenticateToken, async (req, res) => {
  const { emails, message,title } = req.body;

  if (!emails || emails.length === 0 || !message || !title) {
    return res.status(400).json({ error: "Emails, title and message are required." });
  }

  try {
    // Iterate through the emails array and send the email
    for (const email of emails) {
      const mailOptions = {
        from: "HTTaxSolutions",
        to: email,
        subject: title,
        text: message,
        html: `<p>${message}</p>`,
      };

      await sendMail(mailOptions.to,mailOptions.subject,mailOptions.text);
    }

    res.json({ message: "Emails sent successfully." });
  } catch (error) {
    console.error("Error sending bulk emails:", error);
    res.status(500).json({ error: "Failed to send emails." });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const token = crypto.randomBytes(32).toString('hex');
  console.log('User Email : ',email);

  try {
    const user = await pool.query('SELECT * FROM htax_registrations WHERE email = ?', [email]);
    console.log('User Data : ',user);
    if (user.length === 0) {
      return res.status(404).json({ message: 'Email not found' });
    }

    // Save token to user record (for example in a password_reset_token column)
    await pool.query('UPDATE htax_registrations SET temp_forget	 = ? WHERE email = ?', [token, email]);

    const resetLink = `${process.env.NODE_ENV==='production'?process.env.MAIL_URL_PROD:process.env.BASE_URL_DEV}reset-password/${token}`;

    const mailOptions = {
      to: email,
      subject: 'Password Reset',
      text: `Click the link to reset your password: ${resetLink}`,
    };

      await sendMail(mailOptions.to,mailOptions.subject,mailOptions.text);
      res.json({ message: "Reset password link sent!" });

  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
console.log('Reset Password ',token,password);
  try {
    const user = await pool.query('SELECT * FROM htax_registrations WHERE temp_forget	 = ?', [token]);
    
    if (user.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('UPDATE htax_registrations SET password = ?, temp_forget	 = NULL WHERE temp_forget	 = ?', [hashedPassword, token]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;
