const express = require("express");
const bodyParser = require("body-parser");
const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes/api");
const registrationRoutes = require("./routes/registrations");
const adminLoginRoutes = require("./routes/adminLogin");
const operatorRoutes = require("./routes/operator");
const operatorAssignUsersRoutes = require("./routes/operatorAssignUsers");
const pricingRoutes = require("./routes/pricing");
const taxDocumentsRoutes = require("./routes/taxDocuments");
const taxDocumentsPrepareRoutes = require("./routes/taxDocumentsPrepare");
const taxDocumentsPreparePaymentDetailsRoutes = require("./routes/taxDocumentsPreparePaymentDetails");
const taxDocumentsSubmitForReviewRoutes = require("./routes/taxDocumentsSubmitForReview");
const taxProfilesRoutes = require("./routes/taxProfiles");
const cors = require("cors"); // Import cors middleware
const path = require("path");

require("dotenv").config();

const app = express();
// Increase the limit for JSON and URL-encoded payloads
app.use(express.json({ limit: '10mb' })); // Adjust the limit as needed
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// app.use(express.static(path.join(__dirname, "public")));
app.use("/profile", express.static(path.join(__dirname, "public/profile")));
app.use("/documents", express.static(path.join(__dirname, "public/documents")));

// Enable CORS for all routes
app.use(
  cors({
    origin: ["http://localhost:3001","https://httaxsolutions.onrender.com", "https://httaxsolutions.onrender.com"], // Multiple origins
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowable methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allowable headers
    credentials: true, // If you need to support credentials
    optionsSuccessStatus: 204, // For legacy browser support
  })
);

app.use(bodyParser.json());
app.use("/auth", authRoutes);
app.use("/api", apiRoutes);
app.use("/registrations", registrationRoutes);

// Secured routes
app.use("/admin", adminLoginRoutes);
app.use("/operators", operatorRoutes);
app.use("/operator-assignments", operatorAssignUsersRoutes);
app.use("/pricing", pricingRoutes);
app.use("/tax-profiles",taxProfilesRoutes)
app.use("/tax-documents", taxDocumentsRoutes);
app.use("/tax-documents-prepare", taxDocumentsPrepareRoutes);
app.use(
  "/tax-documents-prepare-payment-details",
  taxDocumentsPreparePaymentDetailsRoutes
);
app.use("/tax-documents-submit-for-review", taxDocumentsSubmitForReviewRoutes);

// Default welcome page
app.get("/", (req, res) => {
  res.send("Welcome to HTTax Solution API Service");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
