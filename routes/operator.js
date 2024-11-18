const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
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

// -------------- New Login Route for Operators --------------

// Login Operator
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
console.log('email,password : ',email,password)
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    const [operators] = await pool.query(
      "SELECT * FROM htax_operator WHERE operator_email = ?",
      [email]
    );

    if (operators.length === 0) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const operator = operators[0];
    const validPassword = await bcrypt.compare(password, operator.password);

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: operator.operator_id, username: operator.username, email: operator.operator_email,user_type:2 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token, user:{id: operator.operator_id, username: operator.username, email: operator.operator_email ,user_type:2} });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// -------------------------------------------------------------

// Create Operator
router.post("/", authenticateToken, async (req, res) => {
  const { operator_name, operator_email, username, password, image, status } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const addDate = new Date();

    await pool.query(
      `INSERT INTO htax_operator (operator_name, operator_email, username, password, password_show, image, status, add_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        operator_name,
        operator_email,
        username,
        hashedPassword,
        password, // Storing raw password as well (consider security implications)
        image,
        status,
        addDate,
      ]
    );
    res.status(201).json({ message: "Operator created successfully." });
  } catch (err) {
    console.error("Create Operator error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get All Operators
router.get("/", authenticateToken, async (req, res) => {
  try {
    const [operators] = await pool.query("SELECT * FROM htax_operator");
    res.json(operators);
  } catch (err) {
    console.error("Get All Operators error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});
// Fetch Assigned Users
router.get("/assigned-users", authenticateToken, async (req, res) => {
  console.log('Users Call ',req.user);
  const operatorId = req.user.id;
  console.log('operatorId ',operatorId);
  try {
    const [users] = await pool.query(
      `SELECT 
         reg_id, 
         email, 
         CONCAT(first_name, ' ', last_name) AS full_name, 
         phone_no, 
         document_status, 
         user_status,
         status,
         tax_profile_id 
       FROM htax_registrations 
       WHERE operator_id = ?`,
      [operatorId]
    );

    res.json(users);
  } catch (err) {
    console.error("Fetch Assigned Users Error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Fetch Documents for a Specific User
router.get("/assigned-users/:reg_id/documents", authenticateToken, async (req, res) => {
  const { reg_id } = req.params;
  const operatorId = req.user.id;

  try {
    // Verify that the user is assigned to the operator
    const [user] = await pool.query(
      `SELECT * FROM htax_registrations WHERE reg_id = ? AND operator_id = ?`,
      [reg_id, operatorId]
    );

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found or not assigned to you." });
    }

    // Fetch documents
    const [documents] = await pool.query(
      `SELECT 
         title, 
         document_name, 
         file_type, 
         operator_review_status, 
         operator_review_date, 
         upload_date, 
         status 
       FROM htax_tax_documents 
       WHERE reg_id = ?`,
      [reg_id]
    );

    res.json(documents);
  } catch (err) {
    console.error("Fetch Documents Error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Download Single Document
// router.get("/documents/download/:document_name", authenticateToken, (req, res) => {
  router.get("/documents/download/:document_name", (req, res) => {

  const { document_name } = req.params;
  const filePath = path.join(__dirname, "../uploads/documents/", document_name);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error("Document not found:", err);
      return res.status(404).json({ message: "Document not found." });
    }

    res.download(filePath, document_name, (err) => {
      if (err) {
        console.error("Error downloading document:", err);
        res.status(500).json({ message: "Error downloading document." });
      }
    });
  });
});

// Download All Documents for a User as a Zip (Optional)
const archiver = require("archiver");
const { sendMail } = require("./mailService");
const { title } = require("process");
router.get("/documents/download-all/:reg_id", authenticateToken, async (req, res) => {
  const { reg_id } = req.params;
  const operatorId = req.user.id;

  try {
    // Verify that the user is assigned to the operator
    const [user] = await pool.query(
      `SELECT * FROM htax_registrations WHERE reg_id = ? AND operator_id = ?`,
      [reg_id, operatorId]
    );

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found or not assigned to you." });
    }

    // Fetch user details to get the username
    const [users] = await pool.query('SELECT first_name, last_name FROM htax_registrations WHERE reg_id = ?', [reg_id]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const username = `${users[0].first_name}_${users[0].last_name}`;
    const currentYear = new Date().getFullYear().toString();
    const uploadDir = path.join(__dirname, '../uploads/documents', currentYear, `${username}_${reg_id}`);

    // Fetch documents
    const [documents] = await pool.query(
      `SELECT document_name FROM htax_tax_documents WHERE reg_id = ?`,
      [reg_id]
    );

    if (documents.length === 0) {
      return res.status(404).json({ message: "No documents found for this user." });
    }

    // Set response headers for zip download
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=user_${reg_id}_documents.zip`);

    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    archive.on("error", (err) => {
      console.error("Archive Error:", err);
      res.status(500).json({ message: "Internal server error." });
    });

    archive.pipe(res);

    // Append each document to the archive
    documents.forEach((doc) => {
      const filePath = path.join(uploadDir, doc.document_name); // Adjust path based on your upload structure
      if (fs.existsSync(filePath)) { // Check if the file exists
        archive.file(filePath, { name: doc.document_name });
      } else {
        console.warn(`File not found: ${filePath}`);
      }
    });

    archive.finalize();
  } catch (err) {
    console.error("Download All Documents Error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});
// router.get("/documents/download-all/:reg_id", authenticateToken, async (req, res) => {
//   const { reg_id } = req.params;
//   const operatorId = req.user.id;

//   try {
//     // Verify that the user is assigned to the operator
//     const [user] = await pool.query(
//       `SELECT * FROM htax_registrations WHERE reg_id = ? AND operator_id = ?`,
//       [reg_id, operatorId]
//     );

//     if (user.length === 0) {
//       return res.status(404).json({ message: "User not found or not assigned to you." });
//     }

//     // Fetch documents
//     const [documents] = await pool.query(
//       `SELECT document_name FROM htax_tax_documents WHERE reg_id = ?`,
//       [reg_id]
//     );

//     if (documents.length === 0) {
//       return res.status(404).json({ message: "No documents found for this user." });
//     }

//     // Set response headers for zip download
//     res.setHeader("Content-Type", "application/zip");
//     res.setHeader("Content-Disposition", `attachment; filename=user_${reg_id}_documents.zip`);

//     const archive = archiver("zip", {
//       zlib: { level: 9 }, // Maximum compression
//     });

//     archive.on("error", (err) => {
//       throw err;
//     });

//     archive.pipe(res);

//     // Append each document to the archive
//     documents.forEach((doc) => {
//       const filePath = path.join(__dirname, "../public/documents/", doc.document_name);
//       archive.file(filePath, { name: doc.document_name });
//     });

//     archive.finalize();
//   } catch (err) {
//     console.error("Download All Documents Error:", err);
//     res.status(500).json({ message: "Internal server error." });
//   }
// });


// Get Operator by ID
router.get("/:operator_id", authenticateToken, async (req, res) => {
  const { operator_id } = req.params;
console.log('Operator ',operator_id)
  try {
    const [operators] = await pool.query(
      "SELECT * FROM htax_operator WHERE operator_id = ?",
      [operator_id]
    );
    if (operators.length === 0) {
      return res.status(404).json({ message: "Operator not found." });
    }

    const operator = operators[0];
    res.json({
      id: operator.operator_id,
      operator_name: operator.operator_name,
      operator_email: operator.operator_email,
      username: operator.username,
      image: operator.image,
      status: operator.status,
      last_login: operator.last_login,
    });
  } catch (err) {
    console.error("Get Operator by ID error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Update Operator Profile
router.put("/profile", authenticateToken, upload.single("image"), async (req, res) => {
  const operatorId = req.user.id;
  const { operator_name, operator_email, username, password, status } = req.body;
  const image = req.file ? req.file.filename : null; // Get the uploaded image filename

  const profilePath = path.join(__dirname, "../public/profile");

  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }

  try {
    let query = `UPDATE htax_operator SET operator_name = ?, operator_email = ?, username = ?, status = ?`;
    const queryParams = [operator_name, operator_email, username, status];

    // If an image is uploaded, add it to the query
    if (image) {
      query += `, image = ?`;
      queryParams.push(image);
    }
console.log('User Image')
    // Handle password update
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = ?, password_show = ?`;
      queryParams.push(hashedPassword, password); // Store raw password too
    }

    query += ` WHERE operator_id = ?`;
    queryParams.push(operatorId);

    await pool.query(query, queryParams);

    res.json({ message: "Profile updated successfully." });
  } catch (err) {
    console.error("Update Operator Profile error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});


// View Profile Image
router.get("/profile/:filename", (req, res) => {
  const filePath = path.join(__dirname, "../public/profile", req.params.filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error serving file:", err);
      res.status(err.status).end();
    }
  });
});

// Upload Documents
router.post("/upload-documents", authenticateToken, async (req, res) => {
  const operatorId = req.user.id;
  const { username } = req.body; // Assuming username is sent in the body
  const year = new Date().getFullYear();

  // Define paths
  const docsDir = path.join(__dirname, "../uploads/documents", year.toString(), `${username}_${operatorId}`);

  // Create directories if they don't exist
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

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
      console.error("Upload Documents error:", err);
      return res.status(500).json({ message: "Error uploading documents." });
    }

    res.json({ message: "Documents uploaded successfully." });
  });
});

// Update Operator by ID (Optional: For Admin Use)
router.put("/:operator_id", authenticateToken, async (req, res) => {
  const { operator_id } = req.params;
  const { operator_name, operator_email, username, password, image, status } = req.body;

  try {
    let query = `UPDATE htax_operator SET operator_name = ?, operator_email = ?, username = ?, image = ?, status = ?`;
    const queryParams = [operator_name, operator_email, username, image, status];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = ?, password_show = ?`;
      queryParams.push(hashedPassword, password);
    }

    query += ` WHERE operator_id = ?`;
    queryParams.push(operator_id);

    await pool.query(query, queryParams);

    res.json({ message: "Operator updated successfully." });
  } catch (err) {
    console.error("Update Operator error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Delete Operator
router.delete("/:operator_id", authenticateToken, async (req, res) => {
  const { operator_id } = req.params;

  try {
    await pool.query("DELETE FROM htax_operator WHERE operator_id = ?", [operator_id]);
    res.json({ message: "Operator deleted successfully." });
  } catch (err) {
    console.error("Delete Operator error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, '../uploads/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Use original name with timestamp to ensure uniqueness
    cb(null, `${file.originalname}`);
  }
});

const uploadDoc = multer({ storage: tempStorage });

const sendDocumentNotification = async (recipientEmail, username,titles, files) => {
  const subject = `New Document(s) Uploaded by ${username}`;
  const text = `
    Hello,

    The following document(s) have been uploaded by ${username} :
    
    ${titles.map((title, index) => `- ${title} (${files[index].originalname})`).join('\n')}
    
    Please review them at your earliest convenience.

    Thank you.
  `;

  await sendMail(recipientEmail, subject, text);
};

// POST /api/operator/upload-documents/:reg_id
router.post('/upload-documents/:reg_id', authenticateToken, uploadDoc.array('documents'), async (req, res) => {
  const { reg_id } = req.params;
  const files = req.files;
  const { titles } = req.body; // Expecting titles as an array

  if (!files || files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded' });
  }

  // Ensure titles are provided and match the number of files
  if (!titles || !Array.isArray(titles) || titles.length !== files.length) {
    return res.status(400).json({ message: 'Titles are required and must match the number of files uploaded' });
  }

  try {
    // Fetch username based on reg_id
    const [users] = await pool.query('SELECT first_name,last_name FROM htax_registrations WHERE reg_id = ?', [reg_id]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const username =`${ users[0].first_name}_${ users[0].last_name}`;
console.log('User Name : ',username);
    const currentYear = new Date().getFullYear().toString();
    const uploadDir = path.join(__dirname, '../uploads/documents', currentYear, `${username}_${reg_id}`);

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uploadDate = new Date();

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const title = titles[i];

      const originalName = file.originalname;
      const storedName = file.filename;
      const fileType = path.extname(originalName).substring(1).toLowerCase(); // e.g., 'pdf', 'jpg'

      // Move file from temp to target directory
      const targetPath = path.join(uploadDir, storedName);
      fs.renameSync(file.path, targetPath);

      // Insert into htax_tax_documents
      const insertQuery = `
        INSERT INTO htax_tax_documents 
        (reg_id, title, document_name, file_type, operator_review_status, operator_review_date, manager_review_status, manager_review_date, upload_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        reg_id,
        title,
        storedName,
        fileType,
        'pending', // operator_review_status
        null,      // operator_review_date
        'pending', // manager_review_status
        null,      // manager_review_date
        uploadDate,
        'active'   // status
      ];
console.log('Query : ',values);
      await pool.query(insertQuery, values);
    }

        // Cleanup temporary files after processing
    const tempDir = path.join(__dirname, '../uploads/temp');
    fs.readdir(tempDir, (err, files) => {
      if (err) {
        console.error('Error reading temp directory:', err);
        return;
      }

      // Delete each file in the temp directory
      files.forEach(file => {
        fs.unlink(path.join(tempDir, file), (err) => {
          if (err) {
            console.error('Error deleting temp file:', err);
          }
        });
      });
    });

    // Determine the recipient email (operator or admin)
    let recipientEmail;
    if (users.operator_id > 0) {
      // Get operator's email
      const [operator] = await pool.query('SELECT operator_email FROM htax_operator WHERE operator_id = ?', [users.operator_id]);
      if (operator.length > 0) {
        recipientEmail = operator[0].email;
      }
    } else {
      // Get admin's email (assuming first admin as the default recipient)
      const [admin] = await pool.query('SELECT email FROM htax_admin_login WHERE status = "active" LIMIT 1');
      if (admin.length > 0) {
        recipientEmail = admin[0].email;
      }
    }

    // Prepare and send the notification email
    if (recipientEmail) {     
      // await transporter.sendMail(mailOptions);
      sendDocumentNotification(recipientEmail,username,titles,files) 
    }

    res.status(200).json({ message: 'Files uploaded, data saved, and notification sent successfully' });
  
  } catch (err) {
    console.error('Error uploading files:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
