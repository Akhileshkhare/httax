// routes/registrations.js
const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const authenticateToken = require("../auth");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// Create a transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  auth: {
    user: "akhileshkhare.work@gmail.com",
    pass: "qvlw zqtj zdsy tfmf",
  },
});

// Function to send verification email
async function sendVerificationEmail(email, verificationCode) {
  try {
    const mailOptions = {
      from: "HTTaxSolutions <akhileshkhare.work@example.com>",
      to: email,
      subject: "Email Verification",
      text: `Your verification code is: ${verificationCode}`,
      html: `<p>Your verification code is: <b>${verificationCode}</b></p>`,
    };

    await transporter.sendMail(mailOptions);
    console.log("Verification email sent");
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
}

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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), ?, ?, ?, ?, ?, ?,?)`,
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
      from: "HTTaxSolutions <akhileshkhare.work@example.com>",
      to: email,
      subject: "Please verify your HTTaxSolutions account",
      text: `Hi ${first_name} ${last_name},\n\nPlease click the link below to verify your email address and activate your account. This link will remain active for 24 hrs.\n\nhttps://httaxsolutions.onrender.com/verify/${verificationCode}\n\nBest Regards,\n\nHTTaxSolutions`,
    };
    

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending verification email:", error);
        return res
          .status(500)
          .json({ error: "Failed to send verification email." });
      }
      console.log("Verification email sent:", info.response);
      res.status(201).json({
        message: "User registered successfully. Verification email sent.",
        reg_id: result.insertId,
      });
    });
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

    //  // Logic for sending emails based on assigned operator
    // if (user.operator_id) {
    //   // If an operator is assigned, send an email to the operator
    //   await sendEmail(operatorEmail, "User Assigned", `You have been assigned the user ${user.first_name} ${user.last_name}.`);
    // }
    
    res.json({ message: "Operator updated successfully!" });
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

//  // Logic for sending emails based on new status
//  const user = currentUser[0];
//  const operatorEmail = user.operator_email; // Assuming operator_email is a field in your table
//  const managerEmail = user.manager_email; // Assuming manager_email is a field in your table

//  if (newStatus === "SubmittedForReview") {
//    await sendEmail(operatorEmail, "User Submitted For Review", `The user ${user.first_name} ${user.last_name} has been submitted for review.`);
//  } else if (newStatus === "ManagerReview") {
//    await sendEmail(managerEmail, "User Under Manager Review", `The user ${user.first_name} ${user.last_name} is now under manager review.`);
//  }


    res.json({ message: "User status updated successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Send bulk emails to filtered users
router.post("/send-emails", authenticateToken, async (req, res) => {
  const { emails, message } = req.body;

  if (!emails || emails.length === 0 || !message) {
    return res.status(400).json({ error: "Emails and message are required." });
  }

  try {
    // Iterate through the emails array and send the email
    for (const email of emails) {
      const mailOptions = {
        from: "HTTaxSolutions <akhileshkhare.work@gmail.com>",
        to: email,
        subject: "Important Update from HTTaxSolutions",
        text: message,
        html: `<p>${message}</p>`,
      };

      await transporter.sendMail(mailOptions);
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

    const resetLink = `https://httaxsolutions.onrender.com/reset-password/${token}`;

    // const transporter = nodemailer.createTransport({
    //   service: 'Gmail',
    //   auth: {
    //     user: 'your-email@gmail.com',
    //     pass: 'your-password',
    //   },
    // });

    const mailOptions = {
      from: "HTTaxSolutions <akhileshkhare.work@example.com>",
      to: email,
      subject: 'Password Reset',
      text: `Click the link to reset your password: ${resetLink}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return res.status(500).json({ message: 'Error sending email' });
      }
      res.json({ message: 'Reset password link has been sent to your email.' });
    });

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
