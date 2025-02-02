const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const authenticateToken = require("../auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const { sendMail } = require("./mailService");
const { title } = require("process");
require("dotenv").config(); // Ensure you have a .env file with JWT_SECRET
const { S3Client, GetObjectCommand,PutObjectCommand,DeleteObjectCommand,DeleteObjectsCommand   } = require("@aws-sdk/client-s3");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3Client = new S3Client({ region: process.env.AWS_REGION ,requestHandler: new NodeHttpHandler({
  connectionTimeout: 600000, // 10 minutes
  socketTimeout: 600000, // 10 minutes
}),});
const axios = require("axios");

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
      { expiresIn: "12h" }
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
    const [user] = await pool.query(
      `SELECT * FROM htax_registrations WHERE reg_id = ? AND operator_id = ?`,
      [reg_id, operatorId]
    );

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found or not assigned to you." });
    }

    const [documents] = await pool.query(
      `SELECT 
        id,
         title, 
         document_name, 
         file_type, 
         s3_key, 
         s3_bucket,
         upload_date, 
         status 
       FROM htax_tax_documents 
       WHERE reg_id = ?`,
      [reg_id]
    );

    // Generate signed URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        const command = new GetObjectCommand({
          Bucket: doc.s3_bucket,
          Key: doc.s3_key,
        });
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiration

        return {
          ...doc,
          signedUrl,
        };
      })
    );

    res.json(documentsWithUrls);
  } catch (err) {
    console.error("Fetch Documents Error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Download Single Document
router.get("/documents/download/:document_name", authenticateToken, async (req, res) => {
  const { document_name } = req.params;

  try {
    const [documents] = await pool.query(
      `SELECT s3_key, s3_bucket FROM htax_tax_documents WHERE document_name = ?`,
      [document_name]
    );

    if (documents.length === 0) {
      return res.status(404).json({ message: "Document not found." });
    }

    const { s3_key, s3_bucket } = documents[0];

    // Generate a signed URL
    const command = new GetObjectCommand({
      Bucket: s3_bucket,
      Key: s3_key,
    });
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiration

    res.json({ signedUrl });
  } catch (err) {
    console.error("Download Document Error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Download All Documents for a User as a Zip (Optional)
router.get("/documents/download-all/:reg_id", authenticateToken, async (req, res) => {
  const { reg_id } = req.params;
  const operatorId = req.user.id;

  try {
    // Verify the user
    const [user] = await pool.query(
      `SELECT * FROM htax_registrations WHERE reg_id = ? AND operator_id = ?`,
      [reg_id, operatorId]
    );

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found or not assigned to you." });
    }

    // Fetch document metadata
    const [documents] = await pool.query(
      `SELECT s3_key, s3_bucket, document_name FROM htax_tax_documents WHERE reg_id = ?`,
      [reg_id]
    );

    if (documents.length === 0) {
      return res.status(404).json({ message: "No documents found for this user." });
    }

    // Set up response for ZIP streaming
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=user_${reg_id}_documents.zip`);

    const archive = archiver("zip", { zlib: { level: 9 } }); // Max compression
    archive.pipe(res);

    for (const doc of documents) {
      const command = new GetObjectCommand({
        Bucket: doc.s3_bucket,
        Key: doc.s3_key,
      });
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiration

      // Fetch the file using the signed URL
      const fileStream = await axios({
        url: signedUrl,
        method: "GET",
        responseType: "stream",
      });

      // Add each file to the ZIP archive
      archive.append(fileStream.data, { name: doc.document_name });
    }

    archive.finalize();
  } catch (err) {
    console.error("Download All Documents Error:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});


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



// Update Operator by ID (Optional: For Admin Use)
router.put("/:operator_id", authenticateToken, async (req, res) => {
  const { operator_id } = req.params;
  const { operator_name, operator_email, username, password, image, status } = req.body;
console.log('Operator Edit : ',req.body);
  try {
    let query = `UPDATE htax_operator SET operator_name = ?, operator_email = ?, username = ?, image = ?, status = ?`;
    const queryParams = [operator_name, operator_email, username, image, status];

    // If a password is provided, hash it and include it in the update query
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
      query += `, password = ?, password_show = ?`; // Add password fields to the query
      queryParams.push(hashedPassword, password);   // Add hashed and plain password to query parameters
    }

    query += ` WHERE operator_id = ?`; // Append the WHERE condition
    queryParams.push(operator_id);    // Add the operator ID to the query parameters

    // Execute the query
    await pool.query(query, queryParams);

    res.json({ message: "Operator updated successfully." }); // Respond with success
  } catch (err) {
    console.error("Update Operator error:", err); // Log the error for debugging
    res.status(500).json({ message: "Internal server error." }); // Respond with an error
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
// Temporary storage setup for Multer
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, "../uploads/temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}${ext}`; // Unique filename
    cb(null, filename);
  },
});

const uploadDoc = multer({ storage: tempStorage }); // Accept up to 10 files



// // POST /api/operator/upload-documents/:reg_id
// router.post(
//   "/upload-documents/:reg_id",
//   authenticateToken,
//   uploadDoc.array("documents"),
//   async (req, res) => {
//     const { reg_id } = req.params;
//     const files = req.files;

//     // Check for uploaded files
//     if (!files || files.length === 0) {
//       return res.status(400).json({ message: "No files uploaded" });
//     }

//     // Normalize titles to an array if a single string is provided
//     let titles = req.body.titles;
//     if (!Array.isArray(titles)) {
//       titles = [titles];
//     }

//     // Ensure titles are provided and match the number of files
//     if (!titles || titles.length !== files.length) {
//       return res.status(400).json({
//         message: "Titles are required and must match the number of files uploaded",
//       });
//     }

//     try {
//       // Fetch username based on reg_id
//       const [users] = await pool.query(
//         "SELECT first_name, last_name, operator_id FROM htax_registrations WHERE reg_id = ?",
//         [reg_id]
//       );

//       if (users.length === 0) {
//         return res.status(404).json({ message: "User not found" });
//       }

//       const username = `${users[0].first_name}_${users[0].last_name}`;
//       const currentYear = new Date().getFullYear().toString();
//       const operatorId = users[0].operator_id;

//       // Iterate through files and upload them to S3
//       for (let i = 0; i < files.length; i++) {
//         const file = files[i];
//         const title = titles[i];
//         const fileType = path.extname(file.originalname).substring(1).toLowerCase();

//         // Ensure the file type is supported
//         if (!["pdf", "doc", "docx", "jpg", "png", "jpeg","zip"].includes(fileType)) {
//           throw new Error(`Unsupported file type: ${fileType}`);
//         }

//         // Define the S3 key
//         const s3Key = `documents/${currentYear}/${username}_${reg_id}/${file.originalname}`;
//         const bucketName = process.env.S3_BUCKET_NAME;

//         // Upload file to S3
//         const fileStream = fs.createReadStream(file.path);
//         const uploadParams = {
//             Bucket: bucketName,
//             Key: s3Key,
//             Body: fileStream,
//             ContentType: file.mimetype,
//         };

//         try {
//           await s3Client.send(new PutObjectCommand(uploadParams));
//           console.log('File : ',i,file)
//         } catch (err) {
//           console.error(`Failed to upload ${file.originalname}:`, err);
//           throw err; // Bubble up the error to handle it outside
//         }

//         // Insert file details into the database
//         const insertQuery = `
//           INSERT INTO htax_tax_documents 
//           (reg_id, title, document_name, file_type, s3_key, s3_bucket, operator_review_status, operator_review_date, manager_review_status, manager_review_date, upload_date, status)
//           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//         `;
//         const values = [
//           reg_id,
//           title,
//           file.originalname,
//           fileType,
//           s3Key,
//           bucketName,
//           0, // operator_review_status
//           null, // operator_review_date
//           0, // manager_review_status
//           null, // manager_review_date
//           new Date(), // upload_date
//           0, // status
//         ];

//         await pool.query(insertQuery, values);

//         // Clean up the temporary file
//         fs.unlinkSync(file.path);
//       }

//       res.status(200).json({
//         message: "Files uploaded to S3, data saved, and notification sent successfully",
//       });
//     } catch (err) {
//       console.error("Error uploading files to S3:", err);
//       res.status(500).json({ message: "Internal server error" });
//     }
//   }
// );


router.post(
  "/upload-documents/:reg_id",
  authenticateToken,
  uploadDoc.array("documents"),
  async (req, res) => {
    const { reg_id } = req.params;
    const files = req.files;

    // Check for uploaded files
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // Normalize titles to an array if a single string is provided
    let titles = req.body.titles;
    if (!Array.isArray(titles)) {
      titles = [titles];
    }

    // Ensure titles are provided and match the number of files
    if (!titles || titles.length !== files.length) {
      return res.status(400).json({
        message: "Titles are required and must match the number of files uploaded",
      });
    }

    try {
      // Fetch username and operator_id based on reg_id
      const [users] = await pool.query(
        "SELECT first_name, last_name, operator_id FROM htax_registrations WHERE reg_id = ?",
        [reg_id]
      );

      if (users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const username = `${users[0].first_name}_${users[0].last_name}`;
      const currentYear = new Date().getFullYear().toString();
      const operatorId = users[0].operator_id;

      // Iterate through files and upload them to S3
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const title = titles[i];
        const fileType = path.extname(file.originalname).substring(1).toLowerCase();

        // Ensure the file type is supported
        if ( ![
          "pdf", 
          "doc", 
          "docx", 
          "xls", 
          "xlsx", 
          "csv", 
          "txt", 
          "jpg", 
          "png", 
          "jpeg", 
          "zip"
        ].includes(fileType)) {
          throw new Error(`Unsupported file type: ${fileType}`);
        }

        // Define the S3 key
        const s3Key = `documents/${currentYear}/${username}_${reg_id}/${file.originalname}`;
        const bucketName = process.env.S3_BUCKET_NAME;

        // Check if the file exists before proceeding
        if (!fs.existsSync(file.path)) {
          console.error(`Temporary file not found: ${file.path}`);
          throw new Error(`${file.originalname} file missing. Please try again.`);
        }

        // Upload file to S3 using a stream
        const fileStream = fs.createReadStream(file.path);
        const uploadParams = {
          Bucket: bucketName,
          Key: s3Key,
          Body: fileStream,
          ContentType: file.mimetype,
        };

        try {
          await s3Client.send(new PutObjectCommand(uploadParams));
          console.log(`Successfully uploaded file: ${file.originalname}`);
        } catch (uploadErr) {
          console.error(`Failed to upload ${file.originalname}:`, uploadErr);
          throw uploadErr;
        } finally {
          // Clean up the temporary file
          // if (fs.existsSync(file.path)) {
          //   fs.unlinkSync(file.path);
          // }
        }

        // Insert file details into the database
        const insertQuery = `
          INSERT INTO htax_tax_documents 
          (reg_id, title, document_name, file_type, s3_key, s3_bucket, operator_review_status, operator_review_date, manager_review_status, manager_review_date, upload_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
          reg_id,
          title,
          file.originalname,
          fileType,
          s3Key,
          bucketName,
          0, // operator_review_status
          null, // operator_review_date
          0, // manager_review_status
          null, // manager_review_date
          new Date(), // upload_date
          0, // status
        ];

        await pool.query(insertQuery, values);
      }
      // Clean up any remaining temporary files
      if (files && files.length > 0) {
        files.forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      res.status(200).json({
        message: "Files uploaded to S3, data saved, and notification sent successfully",
      });
    } catch (err) {
      console.error("Error uploading files to S3:", err);

      // Clean up any remaining temporary files
      if (files && files.length > 0) {
        files.forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }

      res.status(500).json({ message: "Internal server error", error: err.message });
    }
  }
);

router.delete("/upload-documents/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Step 1: Fetch document details from the database
    const [documents] = await pool.query(
      "SELECT s3_key, s3_bucket FROM htax_tax_documents WHERE id = ?",
      [id]
    );

    if (documents.length === 0) {
      return res.status(404).json({ message: "Tax document not found." });
    }

    const { s3_key, s3_bucket } = documents[0];

    // Step 2: Delete the document from S3
    const deleteParams = {
      Bucket: s3_bucket,
      Key: s3_key,
    };

    try {
      await s3Client.send(new DeleteObjectCommand(deleteParams));
    } catch (s3Error) {
      console.error("Error deleting document from S3:", s3Error);
      return res.status(500).json({ message: "Failed to delete document from S3." });
    }

    // Step 3: Remove the record from the database
    const [result] = await pool.query("DELETE FROM htax_tax_documents WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Tax document not found in the database." });
    }

    res.json({ message: "Tax document deleted successfully." });
  } catch (err) {
    console.error("Error deleting tax document:", err);
    res.status(500).json({ message: "Internal server error." });
  }
});
router.delete(
  "/upload-documents/user/:reg_id",
  authenticateToken,
  async (req, res) => {
    const { reg_id } = req.params;

    try {
      // Step 1: Fetch all document details for the user from the database
      const [documents] = await pool.query(
        "SELECT s3_key, s3_bucket FROM htax_tax_documents WHERE reg_id = ?",
        [reg_id]
      );

      if (documents.length === 0) {
        return res.status(404).json({ message: "No documents found for this user." });
      }

      // Step 2: Delete all documents from S3
      const deleteObjectsParams = {
        Bucket: documents[0].s3_bucket, // Assuming all documents are in the same bucket
        Delete: {
          Objects: documents.map((doc) => ({ Key: doc.s3_key })),
        },
      };

      try {
        await s3Client.send(new DeleteObjectsCommand(deleteObjectsParams));
      } catch (s3Error) {
        console.error("Error deleting documents from S3:", s3Error);
        return res
          .status(500)
          .json({ message: "Failed to delete some or all documents from S3." });
      }

      // Step 3: Remove all records for the user from the database
      const [result] = await pool.query(
        "DELETE FROM htax_tax_documents WHERE reg_id = ?",
        [reg_id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "No documents found in the database." });
      }

      res.json({ message: "All documents deleted successfully for the user." });
    } catch (err) {
      console.error("Error deleting documents for user:", err);
      res.status(500).json({ message: "Internal server error." });
    }
  }
);

module.exports = router;
