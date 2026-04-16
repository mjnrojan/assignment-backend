const express = require("express");
const controller = require("../controllers/auth.controller");
const verifyToken = require("../middleware/auth");
const { authRateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.post("/register", authRateLimiter, controller.register);
router.post("/login", authRateLimiter, controller.login);
router.post("/google", authRateLimiter, controller.googleLogin);
router.post("/refresh-token", controller.refreshAccessToken);
router.post("/logout", verifyToken, controller.logout);
router.post("/forgot-password", authRateLimiter, controller.forgotPassword);
router.post("/reset-password/:token", authRateLimiter, controller.resetPassword);
router.get("/verify-email/:token", controller.verifyEmail);
router.get("/me", verifyToken, controller.me);
router.delete("/me", verifyToken, controller.deleteMe);
router.patch("/settings", verifyToken, controller.updateSettings);

module.exports = router;
