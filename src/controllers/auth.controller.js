const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/user.model");
const {
  generateAccessToken,
  generateRefreshToken,
  generateVerificationToken
} = require("../utils/generateToken");
const hashToken = require("../utils/hashToken");
const { JWT_VERIFICATION_SECRET, GOOGLE_CLIENT_ID } = require("../config/config");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} = require("../services/email.service");

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const register = async (req, res, next) => {
  try {
    const { firstName, lastName, username, email, password } = req.body;
    if (!firstName || !username || !email || !password) {
      return errorResponse(res, 400, "Missing required fields", "VALIDATION_ERROR");
    }

    const exists = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() }
      ]
    });
    if (exists) {
      return errorResponse(res, 400, "User or email already exists", "USER_EXISTS");
    }

    const user = await User.create({
      firstName,
      lastName: lastName || "",
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash: password,
    });

    const verificationToken = generateVerificationToken({ userId: user._id });
    user.verificationToken = hashToken(verificationToken);

    const accessToken = generateAccessToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id });

    user.refreshToken = hashToken(refreshToken);
    await user.save();

    await sendVerificationEmail(user, verificationToken);

    return successResponse(
      res,
      201,
      { user, accessToken, refreshToken },
      null,
      "Account created! Please check your email to verify your account."
    );
  } catch (error) {
    next(error);
  }
};

const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return errorResponse(res, 400, "Google ID Token required", "VALIDATION_ERROR");

    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, given_name, family_name, picture, sub: googleId } = payload;

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Generate unique username from googleId digits
      let username = `user_${googleId.substring(0, 8)}`;
      for (let len = 9; await User.findOne({ username }) && len <= googleId.length; len++) {
        username = `user_${googleId.substring(0, len)}`;
      }

      user = await User.create({
        firstName: given_name || 'User',
        lastName: family_name || '',
        email: email.toLowerCase(),
        username,
        isEmailVerified: true,
        profileImage: picture,
      });

      await sendWelcomeEmail(user);
    }

    const accessToken = generateAccessToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id });

    user.refreshToken = hashToken(refreshToken);
    await user.save();

    return successResponse(res, 200, { user, accessToken, refreshToken }, null, "Logged in with Google");
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (email || username || "").toLowerCase();
    
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier }
      ]
    }).select("+passwordHash");

    if (!user || !(await user.comparePassword(password || ""))) {
      return errorResponse(res, 401, "Invalid credentials", "INVALID_CREDENTIALS");
    }

    const accessToken = generateAccessToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id });

    user.refreshToken = hashToken(refreshToken);
    await user.save();

    return successResponse(res, 200, { user, accessToken, refreshToken }, null, "Login successful");
  } catch (error) {
    next(error);
  }
};

const refreshAccessToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return errorResponse(res, 400, "Refresh token is required", "TOKEN_REQUIRED");
    }

    const hashedToken = hashToken(token);
    const user = await User.findOne({ refreshToken: hashedToken }).select("+refreshToken");
    if (!user) {
      return errorResponse(res, 401, "Invalid or expired refresh token", "INVALID_TOKEN");
    }

    const accessToken = generateAccessToken({ userId: user._id, role: user.role });
    return successResponse(res, 200, { accessToken }, null, "Token refreshed");
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res) =>
  successResponse(res, 200, null, null, "Logged out successfully");

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return errorResponse(res, 404, "Email not found", "NOT_FOUND");
    }

    const resetToken = generateVerificationToken({ userId: user._id });
    user.resetPasswordToken = hashToken(resetToken);
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password/${resetToken}`;
    await sendPasswordResetEmail(user, resetUrl);

    return successResponse(res, 200, null, null, "Password reset link sent to email");
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_VERIFICATION_SECRET);
    } catch (err) {
      return errorResponse(res, 400, "Invalid or expired reset link", "INVALID_TOKEN");
    }

    const user = await User.findOne({
      _id: decoded.userId,
      resetPasswordToken: hashToken(token),
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return errorResponse(res, 400, "Invalid or expired reset link", "INVALID_TOKEN");
    }

    user.passwordHash = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return successResponse(res, 200, null, null, "Password reset successful");
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_VERIFICATION_SECRET);
    } catch (err) {
      return errorResponse(res, 400, "Invalid or expired verification link", "INVALID_TOKEN");
    }

    const user = await User.findOne({
      _id: decoded.userId,
      verificationToken: hashToken(token),
    });

    if (!user) {
      return errorResponse(res, 400, "Invalid verification link", "INVALID_TOKEN");
    }

    user.isEmailVerified = true;
    user.verificationToken = undefined;
    await user.save();

    await sendWelcomeEmail(user);

    return successResponse(res, 200, null, null, "Email verified successfully! You can now log in to your dashboard.");
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
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

    await User.findByIdAndDelete(req.user.userId);
    return successResponse(res, 200, null, null, "Account deleted successfully");
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const { isPrivate, isProfessional, savesPublic } = req.body;
    const update = {};
    if (typeof isPrivate === "boolean") update.isPrivate = isPrivate;
    if (typeof isProfessional === "boolean") update.isProfessional = isProfessional;
    if (typeof savesPublic === "boolean") update.savesPublic = savesPublic;

    const user = await User.findByIdAndUpdate(req.user.userId, update, { new: true });
    return successResponse(res, 200, { user }, null, "Settings updated");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  refreshAccessToken,
  me,
  deleteMe,
  updateSettings,
};
