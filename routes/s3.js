const AWS = require("aws-sdk");
require("dotenv").config(); 


const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

module.exports = s3;

// Upload a File

// export const uploadFile = async (fileContent, fileName) => {
//     const params = {
//       Bucket: "httaxdoc",
//       Key: `uploads/${fileName}`,
//       Body: fileContent,
//       ContentType: "application/octet-stream"
//     };
  
//     try {
//       const result = await s3.upload(params).promise();
//       console.log("File uploaded successfully:", result.Location);
//       return result;
//     } catch (error) {
//       console.error("Error uploading file:", error);
//       throw error;
//     }
//   };
  

// Generate Pre-Signed URL

// export const generatePresignedUrl = async (fileName) => {
//     const params = {
//       Bucket: "httaxdoc",
//       Key: `uploads/${fileName}`,
//       Expires: 60 // URL valid for 60 seconds
//     };
  
//     try {
//       const url = await s3.getSignedUrlPromise("putObject", params);
//       console.log("Generated Pre-Signed URL:", url);
//       return url;
//     } catch (error) {
//       console.error("Error generating pre-signed URL:", error);
//       throw error;
//     }
//   };
  