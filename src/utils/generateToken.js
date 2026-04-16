const jwt = require("jsonwebtoken");
const { 
  JWT_SECRET, 
  JWT_EXPIRES_IN, 
  JWT_REFRESH_SECRET, 
  JWT_REFRESH_EXPIRES_IN,
  JWT_VERIFICATION_SECRET
} = require("../config/config");

/**
 * Generate Access Token
 */
const generateAccessToken = ({ userId, role }) =>
  jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

/**
 * Generate Refresh Token
 */
const generateRefreshToken = ({ userId }) =>
  jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

/**
 * Generate Verification Token (Email/Password)
 */
const generateVerificationToken = ({ userId }) =>
  jwt.sign(
    { userId },
    JWT_VERIFICATION_SECRET,
    { expiresIn: "24h" } // Verification tokens last 24 hours
  );

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateVerificationToken,
};
