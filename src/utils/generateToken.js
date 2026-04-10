const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/config");

const generateToken = ({ userId, role }) =>
  jwt.sign(
    {
      userId,
      role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN || "24h" }
  );

module.exports = generateToken;
