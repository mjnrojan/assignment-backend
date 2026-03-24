const userService = require("../services/user.service");
const { NODE_ENV } = require("../config/config");

// Simple validation helper - easy for beginners to understand
const validateRegister = (data) => {
  const errors = [];
  
  if (!data.name || data.name.trim() === "") {
    errors.push("Name is required");
  }
  
  if (!data.email || data.email.trim() === "") {
    errors.push("Email is required");
  } else if (!data.email.includes("@")) {
    errors.push("Please provide a valid email address");
  }
  
  if (!data.password || data.password === "") {
    errors.push("Password is required");
  } else if (data.password.length < 6) {
    errors.push("Password must be at least 6 characters");
  }
  
  return errors;
};

const validateLogin = (data) => {
  const errors = [];
  
  if (!data.email || data.email.trim() === "") {
    errors.push("Email is required");
  }
  
  if (!data.password || data.password === "") {
    errors.push("Password is required");
  }
  
  return errors;
};

const validateUpdateProfile = (data) => {
  const errors = [];
  const allowedFields = ["name", "phone", "address", "avatar"];
  
  const updateKeys = Object.keys(data);
  const invalidFields = updateKeys.filter(key => !allowedFields.includes(key));
  
  if (invalidFields.length > 0) {
    errors.push(`Cannot update these fields: ${invalidFields.join(", ")}`);
  }
  
  return errors;
};

const validateChangePassword = (data) => {
  const errors = [];
  
  if (!data.currentPassword || data.currentPassword === "") {
    errors.push("Current password is required");
  }
  
  if (!data.newPassword || data.newPassword === "") {
    errors.push("New password is required");
  } else if (data.newPassword.length < 6) {
    errors.push("New password must be at least 6 characters");
  }
  
  return errors;
};

const handleError = (res, error) => {
  console.error("Controller Error:", error.message);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
    ...(NODE_ENV === "development" && { stack: error.stack }),
  });
};

const register = async (req, res) => {
  try {
    // Simple validation
    const errors = validateRegister(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    const { name, email, password, role } = req.body;
    const result = await userService.registerUser({ name, email, password, role });
    res.status(201).json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    handleError(res, error);
  }
};

const login = async (req, res) => {
  try {
    // Simple validation
    const errors = validateLogin(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    const { email, password } = req.body;
    const result = await userService.loginUser(email, password);
    res.status(200).json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    handleError(res, error);
  }
};

const getProfile = async (req, res) => {
  try {
    const result = await userService.getUserProfile(req.user.id);
    res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    handleError(res, error);
  }
};

const updateProfile = async (req, res) => {
  try {
    // Simple validation
    const errors = validateUpdateProfile(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    const result = await userService.updateUserProfile(req.user.id, req.body);
    res.status(200).json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    handleError(res, error);
  }
};

const getAllUsers = async (req, res) => {
  try {
    const options = {
      page: req.query.page,
      limit: req.query.limit,
      includeInactive: req.query.includeInactive === "true",
    };
    const result = await userService.getAllUsers(options);
    res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    handleError(res, error);
  }
};

const getUserById = async (req, res) => {
  try {
    const result = await userService.getUserProfile(req.params.id);
    res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    handleError(res, error);
  }
};

const changePassword = async (req, res) => {
  try {
    // Simple validation
    const errors = validateChangePassword(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    const { currentPassword, newPassword } = req.body;
    const result = await userService.changePassword(req.user.id, currentPassword, newPassword);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    handleError(res, error);
  }
};

const deactivateUser = async (req, res) => {
  try {
    const result = await userService.deactivateUser(req.params.id);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    handleError(res, error);
  }
};

const createUser = async (req, res) => {
  try {
    // Simple validation (same as register)
    const errors = validateRegister(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    const { name, email, password, role } = req.body;
    const result = await userService.registerUser({ name, email, password, role });
    res.status(201).json({ success: true, message: result.message, data: result.data });
  } catch (error) {
    handleError(res, error);
  }
};

const logout = async (req, res) => {
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    const result = await userService.updateUserProfile(req.user.id, { avatar: avatarPath });
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const avatarUrl = `${baseUrl}${avatarPath}`;
    res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      data: { user: result.data.user, avatarUrl },
    });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  getAllUsers,
  getUserById,
  changePassword,
  deactivateUser,
  createUser,
  logout,
  uploadAvatar,
};
