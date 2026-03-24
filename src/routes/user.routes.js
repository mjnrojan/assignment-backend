const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");
const { protect, adminOnly } = require("../middleware/auth.middleware");
const { avatarUploadMiddleware } = require("../middleware/upload.middleware");

// Public routes
router.post("/register", userController.register);
router.post("/login", userController.login);
router.post("/create", userController.createUser);

// Protected routes (authentication required)
router.post("/logout", protect, userController.logout);
router.get("/profile", protect, userController.getProfile);
router.put("/profile", protect, userController.updateProfile);
router.post("/change-password", protect, userController.changePassword);
router.post("/profile/avatar", protect, avatarUploadMiddleware, userController.uploadAvatar);

// Admin routes
router.get("/", protect, adminOnly, userController.getAllUsers);
router.get("/:id", protect, adminOnly, userController.getUserById);
router.delete("/:id", protect, adminOnly, userController.deactivateUser);

module.exports = router;
