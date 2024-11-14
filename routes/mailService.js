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
      from: `HTTaxSolutions <${process.env.EMAIL_USER}>`,    
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
      from: `HTTaxSolutions <${process.env.EMAIL_USER}>`,    
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
