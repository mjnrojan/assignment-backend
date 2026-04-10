const express = require("express");
const controller = require("../controllers/profile.controller");
const verifyToken = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const { avatarUpload } = require("../middleware/upload");

const router = express.Router();

router.get("/me", verifyToken, controller.getMyProfile);
router.put("/me", verifyToken, controller.updateProfile);
router.post("/me/avatar", verifyToken, avatarUpload, controller.uploadAvatar);
router.get("/:userId", optionalAuth, controller.getPublicProfile);

module.exports = router;
