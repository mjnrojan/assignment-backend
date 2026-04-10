const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/config");
const User = require("../models/user.model");

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Missing bearer token", code: "UNAUTHORIZED" });
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.userId).select("-passwordHash");

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Invalid token user", code: "UNAUTHORIZED" });
    }

    req.user = { userId: user._id.toString(), role: user.role, email: user.email };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Not authorized", code: "UNAUTHORIZED" });
  }
};

module.exports = verifyToken;
