
// const BUCKET_NAME = process.env.S3_BUCKET_NAME;
// // Retry logic for S3 uploads
// const uploadWithRetry = async (command, retries = 5) => {
//   for (let attempt = 0; attempt < retries; attempt++) {
//     try {
//       return await s3Client.send(command);
//     } catch (error) {
//       if (error.Code === "SlowDown" && attempt < retries - 1) {
//         const delay = Math.pow(2, attempt) * 100; // Exponential backoff
//         console.log(`Retrying in ${delay}ms due to SlowDown error...`);
//         await new Promise((resolve) => setTimeout(resolve, delay));
//       } else {
//         throw error;
//       }
//     }
//   }
//   throw new Error("Failed after multiple retries.");
// };

// // Multipart upload for large files
// const multipartUpload = async (filePath, bucket, key) => {
//   const fileStream = fs.createReadStream(filePath);
//   const fileSize = fs.statSync(filePath).size;
//   const partSize = 5 * 1024 * 1024; // 5 MB
//   const totalParts = Math.ceil(fileSize / partSize);

//   const createResponse = await s3Client.send(
//     new CreateMultipartUploadCommand({ Bucket: bucket, Key: key })
//   );
//   const uploadId = createResponse.UploadId;

//   try {
//     const parts = [];
//     for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
//       const start = (partNumber - 1) * partSize;
//       const end = Math.min(start + partSize, fileSize);
//       const partStream = fs.createReadStream(filePath, { start, end: end - 1 });

//       const uploadPartResponse = await s3Client.send(
//         new UploadPartCommand({
//           Bucket: bucket,
//           Key: key,
//           PartNumber: partNumber,
//           UploadId: uploadId,
//           Body: partStream,
//         })
//       );

//       parts.push({
//         ETag: uploadPartResponse.ETag,
//         PartNumber: partNumber,
//       });
//     }

//     await s3Client.send(
//       new CompleteMultipartUploadCommand({
//         Bucket: bucket,
//         Key: key,
//         UploadId: uploadId,
//         MultipartUpload: { Parts: parts },
//       })
//     );
//   } catch (error) {
//     console.error("Multipart upload failed:", error);
//     throw error;
//   }
// };

// // API Endpoint for document upload
// router.post(
//   "/upload-documents/:reg_id",
//   authenticateToken,
//   upload.array("documents"),
//   async (req, res) => {
//     const { reg_id } = req.params;
//     const files = req.files;

//     // Validate uploaded files
//     if (!files || files.length === 0) {
//       return res.status(400).json({ message: "No files uploaded" });
//     }

//     // Normalize titles from request body
//     let titles = req.body.titles;
//     if (!Array.isArray(titles)) {
//       titles = [titles];
//     }
//     if (!titles || titles.length !== files.length) {
//       return res.status(400).json({
//         message: "Titles are required and must match the number of files uploaded",
//       });
//     }

//     try {
//       // Fetch user details
//       const [users] = await pool.query(
//         "SELECT first_name, last_name FROM htax_registrations WHERE reg_id = ?",
//         [reg_id]
//       );
//       if (users.length === 0) {
//         return res.status(404).json({ message: "User not found" });
//       }

//       const username = `${users[0].first_name}_${users[0].last_name}`;
//       const currentYear = new Date().getFullYear().toString();

//       // Upload each file
//       for (let i = 0; i < files.length; i++) {
//         const file = files[i];
//         const title = titles[i];
//         const fileType = path.extname(file.originalname).substring(1).toLowerCase();

//         if (!["pdf", "doc", "docx", "jpg", "png", "jpeg", "zip"].includes(fileType)) {
//           throw new Error(`Unsupported file type: ${fileType}`);
//         }

//         const s3Key = `documents/${currentYear}/${username}_${reg_id}/${file.originalname}`;

//         if (file.size > 5 * 1024 * 1024) {
//           // Multipart upload for large files
//           await multipartUpload(file.path, BUCKET_NAME, s3Key);
//         } else {
//           // Standard upload for smaller files
//           const fileContent = fs.readFileSync(file.path);
//           const uploadParams = {
//             Bucket: BUCKET_NAME,
//             Key: s3Key,
//             Body: fileContent,
//             ContentType: file.mimetype,
//           };
//           await uploadWithRetry(new PutObjectCommand(uploadParams));
//         }

//         // Insert file details into the database
//         const insertQuery = `
//           INSERT INTO htax_tax_documents 
//           (reg_id, title, document_name, file_type, s3_key, s3_bucket, upload_date, status)
//           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
//         `;
//         const values = [
//           reg_id,
//           title,
//           file.originalname,
//           fileType,
//           s3Key,
//           BUCKET_NAME,
//           new Date(),
//           0, // status
//         ];
//         await pool.query(insertQuery, values);

//         // Clean up temporary file
//         fs.unlinkSync(file.path);
//       }

//       res.status(200).json({
//         message: "Files uploaded successfully",
//       });
//     } catch (err) {
//       console.error("Error uploading files:", err);
//       res.status(500).json({ message: "Internal server error" });
//     }
//   }
// );