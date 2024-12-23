// services/mailService.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to send an email to a single recipient
const sendMail = async (to, subject, text, html = null) => {
  try {
    const mailOptions = {
      from: `HTTaxSolutions`,    
      to,
      subject,
      text,
      ...(html && { html }),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

// Function to send an email to multiple recipients
const sendMailToMultiple = async (recipients, subject, text, html = null) => {
  try {
    const mailOptions = {
      from: `HTTaxSolutions <contact@httaxsolutions.com>`,    
      to: recipients.join(", "), // Join multiple emails with commas
      subject,
      text,
      ...(html && { html }),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent to multiple recipients:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email to multiple recipients:", error);
    throw error;
  }
};

module.exports = {
  sendMail,
  sendMailToMultiple,
};


// // services/mailService.js
// const nodemailer = require('nodemailer');
// const pool = require('../db'); // Ensure this points to your database connection pool

// // Function to get SMTP configuration from the database
// const getSMTPConfig = async () => {
//   try {
//     const [rows] = await pool.query('SELECT smtp_host, smtp_port, smtp_username, smtp_password, is_smtp, mail_title FROM htax_configuration WHERE id = 1');
//     if (rows.length === 0) {
//       throw new Error('SMTP configuration not found');
//     }
//     return rows[0];
//   } catch (error) {
//     console.error('Error fetching SMTP configuration:', error);
//     throw error;
//   }
// };

// // Function to create a transporter using the SMTP configuration
// const createTransporter = async () => {
//   const config = await getSMTPConfig();
//   console.log('Mail config : ',config);
//   if (config.is_smtp !== 1) {
//     throw new Error('SMTP is disabled in the configuration');
//   }
//   return nodemailer.createTransport({
//     host: config.smtp_host,
//     port: config.smtp_port,
//     secure: config.smtp_port === 465, // true for port 465, false for other ports
//     auth: {
//       user: config.smtp_username,
//       pass: config.smtp_password,
//     },
//   });
// };

// // Function to send an email
// const sendMail = async (to, subject, text, html = null) => {
//   try {
//     const config = await getSMTPConfig();
//     const transporter = await createTransporter();
//     const mailOptions = {
//       from: `${config.mail_title} <${config.smtp_username}>`,
//       to,
//       subject,
//       text,
//       ...(html && { html }),
//     };
//     const info = await transporter.sendMail(mailOptions);
//     console.log('Email sent:', info.messageId);
//     return info;
//   } catch (error) {
//     console.error('Error sending email:', error);
//     throw error;
//   }
// };

// // Function to send an email to multiple recipients
// const sendMailToMultiple = async (recipients, subject, text, html = null) => {
//   try {
//     const transporter = await createTransporter();
//     const config = await getSMTPConfig();
//     const mailOptions = {
//       from: `${config.mail_title} <${config.smtp_username}>`,
//       to: recipients.join(', '), // Join multiple emails with commas
//       subject,
//       text,
//       ...(html && { html }),
//     };
//     const info = await transporter.sendMail(mailOptions);
//     console.log('Email sent to multiple recipients:', info.messageId);
//     return info;
//   } catch (error) {
//     console.error('Error sending email to multiple recipients:', error);
//     throw error;
//   }
// };

// module.exports = {
//   sendMail,
//   sendMailToMultiple,
// };
