const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/config");
const User = require("../models/user.model");

/**
 * Optional authentication middleware.
 * If a valid token is provided, populates req.user.
 * If no token is provided or token is invalid, it just moves to the next middleware
 * without setting req.user.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(payload.userId).select("-passwordHash");

      if (user && user.isActive) {
        req.user = { 
          userId: user._id.toString(), 
          role: user.role, 
          email: user.email 
        };
      }
    }
    next();
  } catch (error) {
    // If token is malformed or expired, we just ignore it for optional auth
    next();
  }
};

module.exports = optionalAuth;
