const express = require("express");
const controller = require("../controllers/recipe.controller");
const verifyToken = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const { recipeImageUpload } = require("../middleware/upload");

const router = express.Router();

// Public (anyone can see the teaser feed)
router.get("/", optionalAuth, controller.listRecipes);
router.get("/feed", optionalAuth, controller.getPersonalizedFeed);
router.get("/user/:userId", optionalAuth, controller.getRecipesByUser);

// Authenticated — Must be logged in to view full details or share
router.get("/:recipeId", verifyToken, controller.getRecipeById);
router.post("/:recipeId/share", verifyToken, controller.shareRecipe);

// Authenticated — any user can post
router.get("/my/all", verifyToken, controller.myRecipes);
router.post("/", verifyToken, controller.createRecipe);
router.put("/:recipeId", verifyToken, controller.updateRecipe);
router.delete("/:recipeId", verifyToken, controller.deleteRecipe);

// Image uploads — owner only (checked inside controller)
router.post("/:recipeId/images/hero", verifyToken, recipeImageUpload, controller.uploadHeroImage);
router.post("/:recipeId/images/steps", verifyToken, recipeImageUpload, controller.uploadStepImages);
router.post("/:recipeId/images/result", verifyToken, recipeImageUpload, controller.uploadResultImage);
router.delete("/:recipeId/images/:slot", verifyToken, controller.deleteImageSlot);

module.exports = router;
