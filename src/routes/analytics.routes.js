const express = require("express");
const controller = require("../controllers/analytics.controller");
const verifyToken = require("../middleware/auth");

const router = express.Router();

// Professional analytics (requires isProfessional = true)
router.get("/profile", verifyToken, controller.profileAnalytics);
router.get("/recipe/:recipeId", verifyToken, controller.recipeAnalytics);

module.exports = router;
