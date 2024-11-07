const jwt = require("jsonwebtoken");
require("dotenv").config();

const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      // Handle token expiration
      res.status(401).json({ message: "Token has expired." });
    } else if (error instanceof jwt.JsonWebTokenError) {
      // Handle invalid token
      res.status(400).json({ message: "Invalid token." });
    } else {
      // Handle other errors
      res.status(400).json({ message: "Authentication error." });
    }
  }
};

module.exports = authenticateToken;
