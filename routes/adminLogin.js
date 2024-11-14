// routes/adminLogin.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const authenticateToken = require("../auth");
require("dotenv").config();


const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../public/profile");
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const adminId = req.user.id;
    const name = req.body.name || "default";
    const ext = path.extname(file.originalname);
    const filename = `${adminId}-${name}${ext}`;
    cb(null, filename);
  },
});

// Initialize multer with the defined storage configuration
const upload = multer({ storage });
const router = express.Router();
// Admin Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Login attempt for user:", email);

  try {
    const [admins] = await pool.query(
      "SELECT * FROM htax_admin_login WHERE email = ?",
      [email]
    );

    if (admins.length === 0) {
      console.log("No admin found with this email");
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const admin = admins[0];
    const validPassword = await bcrypt.compare(password, admin.password);
    console.log("Provided password:", admins.length, admins);
    console.log("Provided password:", password);
    console.log("Hashed password from DB:", admin.password);
    console.log("Password comparison result:", validPassword);

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, email: admin.email,user_type: 3 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token,user: { id: admin.id, username: admin.username, email: admin.email ,user_type:3} });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Register Admin
router.post("/register", async (req, res) => {
  const { username, name, email, password, image, admin_type, status } =
    req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO htax_admin_login (username, name, email, email_md5, password, password_show, image, admin_type, status) VALUES (?, ?, ?, MD5(?), ?, ?, ?, ?, ?)`,
      [
        username,
        name,
        email,
        email,
        hashedPassword,
        password,
        image,
        admin_type,
        status,
      ]
    );

    res.status(201).json({ message: "Admin registered successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get Admin Profile
router.get("/profile", authenticateToken, async (req, res) => {
  const adminId = req.user.id;

  try {
    const [admins] = await pool.query(
      "SELECT * FROM htax_admin_login WHERE id = ?",
      [adminId]
    );

    if (admins.length === 0) {
      return res.status(404).json({ message: "Admin not found." });
    }

    const admin = admins[0];
    res.json({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      email: admin.email,
      image: admin.image,
      admin_type: admin.admin_type,
      status: admin.status,
      last_login: admin.last_login,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Update Admin Profile
router.put("/profile", authenticateToken, upload.single("image"), async (req, res) => {
  const adminId = req.user.id;
  const { name, email, password, status } = req.body;
  const image = req.file ? req.file.filename : null; // Get the uploaded image filename

  // Path to the profile directory
  const profilePath = path.join(__dirname, "../public/profile");

  // Check if the profile directory exists, and create it if it doesn't
  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }

  try {
    let query = `UPDATE htax_admin_login SET name = ?, email = ?, status = ?`;
    const queryParams = [name, email, status];

    // If an image is uploaded, add it to the query
    if (image) {
      query += `, image = ?`;
      queryParams.push(image);
    }

    // Handle password update
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = ?, password_show = ?`;
      queryParams.push(hashedPassword, password);
    }

    query += ` WHERE id = ?`;
    queryParams.push(adminId);

    await pool.query(query, queryParams);

    res.json({ message: "Profile updated successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error." });
  }
});
router.get("/profile/:filename", (req, res) => {
  const filePath = path.join(__dirname, "public/profile", req.params.filename);
  console.log("Attempting to serve file from:", filePath);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error serving file:", err);
      res.status(err.status).end();
    }
  });
});

/**
 * @route   GET /api/enquiries
 * @desc    Fetch all enquiries
 * @access  Protected
 */
router.get('/enquiries', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM htax_enquiry'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching enquiries:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * @route   DELETE /api/enquiries/:id
 * @desc    Delete an enquiry by ID
 * @access  Protected
 */
router.delete('/enquiries/:id', authenticateToken, async (req, res) => {
  const enquiryId = req.params.id;

  try {
    const [result] = await pool.query('DELETE FROM htax_enquiry WHERE id = ?', [enquiryId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Enquiry not found.' });
    }
    res.json({ message: 'Enquiry deleted successfully.' });
  } catch (err) {
    console.error('Error deleting enquiry:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});
/**
 * @route   GET /api/testimonials
 * @desc    Fetch all testimonials
 * @access  Protected
 */
router.get('/testimonials', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, designation, content, image, is_status, is_delete, add_date FROM htax_testimonial WHERE is_delete = 0'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching testimonials:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * @route   PUT /api/testimonials/:id
 * @desc    Update a testimonial by ID
 * @access  Protected
 */
router.put(
  '/testimonials/:id',
  authenticateToken,
  upload.single('image'), // Handle image upload if updating the image
  async (req, res) => {
    const testimonialId = parseInt(req.params.id, 10);

    if (isNaN(testimonialId)) {
      return res.status(400).json({ message: 'Invalid testimonial ID.' });
    }

    const { name, designation, content, is_status } = req.body;
    const image = req.file ? req.file.filename : null;

    // Path to the testimonials images directory
    const imagePath = path.join(__dirname, '../../public/images/testimonials');

    // Ensure the directory exists
    if (!fs.existsSync(imagePath)) {
      fs.mkdirSync(imagePath, { recursive: true });
    }

    try {
      let query = `UPDATE htax_testimonial SET name = ?, designation = ?, content = ?, is_status = ?`;
      const queryParams= [name, designation, content, is_status];

      // If an image is uploaded, add it to the query
      if (image) {
        query += `, image = ?`;
        queryParams.push(image);
      }

      query += ` WHERE id = ?`;
      queryParams.push(testimonialId);

      const [result] = await pool.query(query, queryParams);

      if ((result).affectedRows === 0) {
        return res.status(404).json({ message: 'Testimonial not found.' });
      }

      res.json({ message: 'Testimonial updated successfully.' });
    } catch (err) {
      console.error('Error updating testimonial:', err);
      res.status(500).json({ message: 'Internal server error.' });
    }
  }
);

/**
 * @route   DELETE /api/testimonials/:id
 * @desc    Soft delete a testimonial by ID
 * @access  Protected
 */
router.delete('/testimonials/:id', authenticateToken, async (req, res) => {
  const testimonialId = parseInt(req.params.id, 10);

  if (isNaN(testimonialId)) {
    return res.status(400).json({ message: 'Invalid testimonial ID.' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE htax_testimonial SET is_delete = 1 WHERE id = ?',
      [testimonialId]
    );

    if ((result ).affectedRows === 0) {
      return res.status(404).json({ message: 'Testimonial not found.' });
    }

    res.json({ message: 'Testimonial deleted successfully.' });
  } catch (err) {
    console.error('Error deleting testimonial:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * @route   GET /api/email-templates
 * @desc    Fetch all email templates
 * @access  Protected
 */
router.get('/email_templates', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, purpose, subject, message, message1, status FROM htax_email_templates WHERE status = 1'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching email templates:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * @route   GET /api/email-templates/:id
 * @desc    Fetch a single email template by ID
 * @access  Protected
 */
router.get('/email_templates/:id', authenticateToken, async (req, res) => {
  const templateId = parseInt(req.params.id, 10);

  if (isNaN(templateId)) {
    return res.status(400).json({ message: 'Invalid email template ID.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, purpose, subject, message, message1, status FROM htax_email_templates WHERE id = ? AND status = 1',
      [templateId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Email template not found.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching email template:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * @route   PUT /api/email-templates/:id
 * @desc    Update an email template by ID
 * @access  Protected
 */
router.put(
  '/email_templates/:id',
  authenticateToken,
  upload.single('image'), // Handle image upload if updating the image
  async (req, res) => {
    const templateId = parseInt(req.params.id, 10);

    if (isNaN(templateId)) {
      return res.status(400).json({ message: 'Invalid email template ID.' });
    }

    const { purpose, subject, message, message1, status } = req.body;
   

    try {
      let query = `UPDATE htax_email_templates SET purpose = ?, subject = ?, message = ?, message1 = ?, status = ?`;
      const queryParams= [purpose, subject, message, message1, status];

      query += ` WHERE id = ? AND status = 1`;
      queryParams.push(templateId);

      const [result] = await pool.query(query, queryParams);

      if ((result ).affectedRows === 0) {
        return res.status(404).json({ message: 'Email template not found or already deleted.' });
      }

      res.json({ message: 'Email template updated successfully.' });
    } catch (err) {
      console.error('Error updating email template:', err);
      res.status(500).json({ message: 'Internal server error.' });
    }
  }
);

/**
 * @route   DELETE /api/email-templates/:id
 * @desc    Soft delete an email template by ID
 * @access  Protected
 */
router.delete('/email_templates/:id', authenticateToken, async (req, res) => {
  const templateId = parseInt(req.params.id, 10);

  if (isNaN(templateId)) {
    return res.status(400).json({ message: 'Invalid email template ID.' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE htax_email_templates SET status = 0 WHERE id = ?',
      [templateId]
    );

    if ((result ).affectedRows === 0) {
      return res.status(404).json({ message: 'Email template not found.' });
    }

    res.json({ message: 'Email template deleted successfully.' });
  } catch (err) {
    console.error('Error deleting email template:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Upload documents
router.post("/upload-documents", authenticateToken, async (req, res) => {
  const adminId = req.user.id;
  const { username } = req.body; // Assuming username is sent in the body
  const year = new Date().getFullYear();
  
  // Define paths
  const docsDir = path.join(__dirname, "../uploads/documents", year.toString(), `${username}_${adminId}`);
  
  // Create directories if they don't exist
  fs.mkdirSync(docsDir, { recursive: true });

  // Setup multer for document uploads
  const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, docsDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = `${Date.now()}${ext}`; // Use timestamp for unique filenames
      cb(null, filename);
    },
  });

  const documentUpload = multer({ storage: documentStorage }).array("documents", 10); // Accept multiple files

  documentUpload(req, res, (err) => {
    if (err) {
      return res.status(500).json({ message: "Error uploading documents." });
    }

    res.json({ message: "Documents uploaded successfully." });
  });
});

// Example usage of sendMailToMultiple

// const { sendMail, sendMailToMultiple } = require('./services/mailService');

// const notifyMultipleUsers = async (recipientEmails, username, reg_id, titles, files) => {
//   const subject = `New Document(s) Uploaded by ${username}`;
//   const text = `
//     Hello,

//     The following document(s) have been uploaded by ${username} (reg_id: ${reg_id}):
    
//     ${titles.map((title, index) => `- ${title} (${files[index].originalname})`).join('\n')}
    
//     Please review them at your earliest convenience.

//     Thank you.
//   `;

//   await sendMailToMultiple(recipientEmails, subject, text);
// };

// router.post('/notify-users', async (req, res) => {
//   const recipientEmails = ['user1@example.com', 'user2@example.com']; // Array of email addresses
//   const username = 'John Doe';
//   const reg_id = 123;
//   const titles = ['Document Title 1', 'Document Title 2'];
//   const files = [{ originalname: 'file1.pdf' }, { originalname: 'file2.pdf' }];

//   try {
//     await notifyMultipleUsers(recipientEmails, username, reg_id, titles, files);
//     res.status(200).json({ message: 'Notifications sent successfully' });
//   } catch (error) {
//     res.status(500).json({ message: 'Failed to send notifications' });
//   }
// });
module.exports = router;
