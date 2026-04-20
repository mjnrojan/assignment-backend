const express = require("express");
const controller = require("../controllers/social.controller");
const verifyToken = require("../middleware/auth");

const router = express.Router();

// Follow
router.post("/follow/:userId", verifyToken, controller.followUser);
router.delete("/unfollow/:userId", verifyToken, controller.unfollowUser);
router.patch("/follow-requests/:requestId/accept", verifyToken, controller.acceptFollowRequest);
router.patch("/follow-requests/:requestId/reject", verifyToken, controller.rejectFollowRequest);
router.get("/follow-requests", verifyToken, controller.getPendingRequests);
router.get("/followers/:userId", controller.getFollowers);
router.get("/following/:userId", controller.getFollowing);

// Like
router.post("/like/:recipeId", verifyToken, controller.likeRecipe);
router.delete("/unlike/:recipeId", verifyToken, controller.unlikeRecipe);
router.post("/like-comment/:commentId", verifyToken, controller.likeComment);
router.delete("/unlike-comment/:commentId", verifyToken, controller.unlikeComment);

// Comment
router.post("/comments/:recipeId", verifyToken, controller.addComment);
router.get("/comments/:recipeId", controller.getComments);
router.delete("/comments/:commentId", verifyToken, controller.deleteComment);

// Save / Bookmark
router.post("/save/:recipeId", verifyToken, controller.saveRecipe);
router.delete("/unsave/:recipeId", verifyToken, controller.unsaveRecipe);
router.get("/saved", verifyToken, controller.getSavedRecipes);
router.post("/dispute/:recipeId", verifyToken, controller.fileDispute);
router.post("/dispute-comment/:commentId", verifyToken, controller.fileCommentDispute);

module.exports = router;
