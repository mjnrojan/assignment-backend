const crypto = require("crypto");
const User = require("../models/user.model");
const Profile = require("../models/profile.model");
const generateToken = require("../utils/generateToken");
const hashToken = require("../utils/hashToken");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} = require("../services/email.service");

const register = async (req, res, next) => {
  try {
    const { firstName, lastName, username, email, password } = req.body;
    if (!firstName || !lastName || !username || !email || !password) {
      return errorResponse(res, 400, "Missing required fields", "VALIDATION_ERROR");
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return errorResponse(res, 400, "User already exists", "USER_EXISTS");
    }

    const verificationRaw = crypto.randomBytes(24).toString("hex");
    const user = await User.create({
      firstName,
      lastName,
      username,
      email: email.toLowerCase(),
      passwordHash: password,
      verificationToken: hashToken(verificationRaw),
    });

    // Auto-create a blank profile for every new user
    await Profile.create({ userId: user._id });

    const token = generateToken({ userId: user._id, role: user.role });
    await Promise.all([sendWelcomeEmail(user), sendVerificationEmail(user, verificationRaw)]);

    return successResponse(
      res,
      201,
      { user, token },
      null,
      "User registered successfully"
    );
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() }).select("+passwordHash");
    if (!user || !(await user.comparePassword(password || ""))) {
      return errorResponse(res, 401, "Invalid email or password", "INVALID_CREDENTIALS");
    }
    const token = generateToken({ userId: user._id, role: user.role });
    return successResponse(res, 200, { user, token }, null, "Login successful");
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res) =>
  successResponse(res, 200, null, null, "Logged out successfully");

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user) {
      return successResponse(res, 200, null, null, "If the account exists, reset email sent");
    }

    const rawToken = crypto.randomBytes(24).toString("hex");
    user.resetToken = hashToken(rawToken);
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await sendPasswordResetEmail(user, `${req.protocol}://${req.get("host")}/reset/${rawToken}`);

    return successResponse(res, 200, null, null, "If the account exists, reset email sent");
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const user = await User.findOne({
      resetToken: hashToken(token),
      resetTokenExpiry: { $gt: new Date() },
    }).select("+passwordHash +resetToken");

    if (!user) {
      return errorResponse(res, 400, "Invalid or expired reset token", "INVALID_TOKEN");
    }

    user.passwordHash = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return successResponse(res, 200, null, null, "Password reset successful");
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ verificationToken: hashToken(token) }).select("+verificationToken");
    if (!user) {
      return errorResponse(res, 400, "Invalid verification token", "INVALID_TOKEN");
    }
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    return successResponse(res, 200, null, null, "Email verified");
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash -resetToken");
    return successResponse(res, 200, { user }, null, "Current user profile");
  } catch (error) {
    next(error);
  }
};

const deleteMe = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      return errorResponse(res, 400, "Password is required to delete account", "PASSWORD_REQUIRED");
    }

    const user = await User.findById(req.user.userId).select("+passwordHash");
    if (!user || !(await user.comparePassword(password))) {
      return errorResponse(res, 401, "Invalid password", "INVALID_CREDENTIALS");
    }

    await Profile.findOneAndDelete({ userId: req.user.userId });
    await User.findByIdAndDelete(req.user.userId);
    return successResponse(res, 200, null, null, "Account deleted successfully");
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const { isPrivate, isProfessional } = req.body;
    const update = {};
    if (typeof isPrivate === "boolean") update.isPrivate = isPrivate;
    if (typeof isProfessional === "boolean") update.isProfessional = isProfessional;

    const user = await User.findByIdAndUpdate(req.user.userId, update, { new: true });
    return successResponse(res, 200, { user }, null, "Settings updated");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  me,
  deleteMe,
  updateSettings,
};
