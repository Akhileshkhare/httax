const express = require("express");
const helmet = require('helmet');
const compression = require('compression');
const bodyParser = require("body-parser");
const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes/api");
const registrationRoutes = require("./routes/registrations");
const adminLoginRoutes = require("./routes/adminLogin");
const operatorRoutes = require("./routes/operator");
const operatorAssignUsersRoutes = require("./routes/operatorAssignUsers");
const pricingRoutes = require("./routes/pricing");
const notificationRoutes = require("./routes/notifications");
const timeout = require('connect-timeout');
const taxDocumentsRoutes = require("./routes/taxDocuments");
const taxDocumentsPrepareRoutes = require("./routes/taxDocumentsPrepare");
const taxDocumentsPreparePaymentDetailsRoutes = require("./routes/taxDocumentsPreparePaymentDetails");
const taxDocumentsSubmitForReviewRoutes = require("./routes/taxDocumentsSubmitForReview");
const taxProfilesRoutes = require("./routes/taxProfiles");
const cors = require("cors"); // Import cors middleware
const path = require("path");

require("dotenv").config();

const app = express();
// Use Helmet to set various HTTP headers for security
app.use(helmet());

// Use Compression to gzip responses for improved performance
app.use(compression());

const apiRouter = express.Router();

const allowedOrigins = [
  'http://localhost:3001',
  'https://www.httaxsolutions.com',
  'https://httaxsolutions.com',
   'http://www.httaxsolutions.com',
  'http://13.126.34.164',
  'https://13.126.34.164'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

app.use(bodyParser.json());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(timeout('600s')); // Set timeout to 10 minutes
app.use((req, res, next) => {
    if (!req.timedout) next();
});

// app.use("/auth", authRoutes);
// app.use("/api", apiRoutes);
// app.use("/registrations", registrationRoutes);

// // Secured routes
// app.use("/admin", adminLoginRoutes);
// app.use("/operators", operatorRoutes);
// app.use("/operator-assignments", operatorAssignUsersRoutes);
// app.use("/pricing", pricingRoutes);
// app.use("/notification", notificationRoutes);

// app.use("/tax-profiles",taxProfilesRoutes)
// app.use("/tax-documents", taxDocumentsRoutes);
// app.use("/tax-documents-prepare", taxDocumentsPrepareRoutes);
// app.use(
//   "/tax-documents-prepare-payment-details",
//   taxDocumentsPreparePaymentDetailsRoutes
// );
// app.use("/tax-documents-submit-for-review", taxDocumentsSubmitForReviewRoutes);

// // Default welcome page
// app.get("/", (req, res) => {
//   res.send("Welcome to HTTax Solution API Service");
// });

apiRouter.use("/auth", authRoutes);
apiRouter.use("/api", apiRoutes);
apiRouter.use("/registrations", registrationRoutes);

// Secured routes
apiRouter.use("/admin", adminLoginRoutes);
apiRouter.use("/operators", operatorRoutes);
apiRouter.use("/operator-assignments", operatorAssignUsersRoutes);
apiRouter.use("/pricing", pricingRoutes);
apiRouter.use("/notification", notificationRoutes);

apiRouter.use("/tax-profiles",taxProfilesRoutes)
apiRouter.use("/tax-documents", taxDocumentsRoutes);
apiRouter.use("/tax-documents-prepare", taxDocumentsPrepareRoutes);
apiRouter.use(
  "/tax-documents-prepare-payment-details",
  taxDocumentsPreparePaymentDetailsRoutes
);
apiRouter.use("/tax-documents-submit-for-review", taxDocumentsSubmitForReviewRoutes);

// Default welcome page
apiRouter.get("/", (req, res) => {
  res.send("Welcome to HTTax Solution API Service");
});
app.use('/api', apiRouter);

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
