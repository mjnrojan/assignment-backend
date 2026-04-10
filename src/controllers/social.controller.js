const User = require("../models/user.model");
const Follow = require("../models/follow.model");
const Like = require("../models/like.model");
const Comment = require("../models/comment.model");
const Save = require("../models/save.model");
const Recipe = require("../models/recipe.model");
const { successResponse, errorResponse } = require("../utils/apiResponse");

// ─── FOLLOW ────────────────────────────────────────────

const followUser = async (req, res, next) => {
  try {
    const targetId = req.params.userId;
    const followerId = req.user.userId;

    if (followerId === targetId) {
      return errorResponse(res, 400, "You cannot follow yourself", "VALIDATION_ERROR");
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return errorResponse(res, 404, "User not found", "NOT_FOUND");
    }

    const existing = await Follow.findOne({ followerId, followingId: targetId });
    if (existing) {
      return errorResponse(res, 400, "Already following or request pending", "ALREADY_FOLLOWING");
    }

    // Private accounts get a pending request; public accounts are auto-accepted
    const status = targetUser.isPrivate ? "pending" : "accepted";
    const follow = await Follow.create({ followerId, followingId: targetId, status });

    if (status === "accepted") {
      await User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });
      await User.findByIdAndUpdate(targetId, { $inc: { followerCount: 1 } });
    }

    return successResponse(res, 201, follow, null,
      status === "accepted" ? "Followed successfully" : "Follow request sent"
    );
  } catch (error) {
    next(error);
  }
};

const unfollowUser = async (req, res, next) => {
  try {
    const targetId = req.params.userId;
    const followerId = req.user.userId;

    const follow = await Follow.findOneAndDelete({ followerId, followingId: targetId });
    if (!follow) {
      return errorResponse(res, 404, "Not following this user", "NOT_FOUND");
    }

    if (follow.status === "accepted") {
      await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
      await User.findByIdAndUpdate(targetId, { $inc: { followerCount: -1 } });
    }

    return successResponse(res, 200, null, null, "Unfollowed successfully");
  } catch (error) {
    next(error);
  }
};

const acceptFollowRequest = async (req, res, next) => {
  try {
    const requestId = req.params.requestId;
    const follow = await Follow.findById(requestId);

    if (!follow || follow.followingId.toString() !== req.user.userId) {
      return errorResponse(res, 404, "Follow request not found", "NOT_FOUND");
    }

    if (follow.status === "accepted") {
      return errorResponse(res, 400, "Already accepted", "ALREADY_ACCEPTED");
    }

    follow.status = "accepted";
    await follow.save();

    await User.findByIdAndUpdate(follow.followerId, { $inc: { followingCount: 1 } });
    await User.findByIdAndUpdate(follow.followingId, { $inc: { followerCount: 1 } });

    return successResponse(res, 200, follow, null, "Follow request accepted");
  } catch (error) {
    next(error);
  }
};

const rejectFollowRequest = async (req, res, next) => {
  try {
    const requestId = req.params.requestId;
    const follow = await Follow.findById(requestId);

    if (!follow || follow.followingId.toString() !== req.user.userId) {
      return errorResponse(res, 404, "Follow request not found", "NOT_FOUND");
    }

    await Follow.findByIdAndDelete(requestId);
    return successResponse(res, 200, null, null, "Follow request rejected");
  } catch (error) {
    next(error);
  }
};

const getFollowers = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const followers = await Follow.find({ followingId: userId, status: "accepted" })
      .populate("followerId", "firstName lastName username");
    const data = followers.map((f) => f.followerId);
    return successResponse(res, 200, data, null, "Followers list");
  } catch (error) {
    next(error);
  }
};

const getFollowing = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const following = await Follow.find({ followerId: userId, status: "accepted" })
      .populate("followingId", "firstName lastName username");
    const data = following.map((f) => f.followingId);
    return successResponse(res, 200, data, null, "Following list");
  } catch (error) {
    next(error);
  }
};

const getPendingRequests = async (req, res, next) => {
  try {
    const requests = await Follow.find({ followingId: req.user.userId, status: "pending" })
      .populate("followerId", "firstName lastName username");
    return successResponse(res, 200, requests, null, "Pending follow requests");
  } catch (error) {
    next(error);
  }
};

// ─── LIKE ──────────────────────────────────────────────

const likeRecipe = async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    const userId = req.user.userId;

    const existing = await Like.findOne({ userId, recipeId });
    if (existing) {
      return errorResponse(res, 400, "Already liked", "ALREADY_LIKED");
    }

    await Like.create({ userId, recipeId });
    await Recipe.findByIdAndUpdate(recipeId, { $inc: { likeCount: 1 } });

    return successResponse(res, 201, null, null, "Recipe liked");
  } catch (error) {
    next(error);
  }
};

const unlikeRecipe = async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    const userId = req.user.userId;

    const deleted = await Like.findOneAndDelete({ userId, recipeId });
    if (!deleted) {
      return errorResponse(res, 404, "Like not found", "NOT_FOUND");
    }

    await Recipe.findByIdAndUpdate(recipeId, { $inc: { likeCount: -1 } });
    return successResponse(res, 200, null, null, "Like removed");
  } catch (error) {
    next(error);
  }
};

// ─── COMMENT ───────────────────────────────────────────

const addComment = async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return errorResponse(res, 400, "Comment text is required", "VALIDATION_ERROR");
    }

    const comment = await Comment.create({
      userId: req.user.userId,
      recipeId,
      text: text.trim(),
    });

    await Recipe.findByIdAndUpdate(recipeId, { $inc: { commentCount: 1 } });

    const populated = await Comment.findById(comment._id)
      .populate("userId", "firstName lastName username");

    return successResponse(res, 201, populated, null, "Comment added");
  } catch (error) {
    next(error);
  }
};

const getComments = async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const skip = (page - 1) * limit;

    const total = await Comment.countDocuments({ recipeId });
    const comments = await Comment.find({ recipeId })
      .sort("-createdAt")
      .skip(skip)
      .limit(limit)
      .populate("userId", "firstName lastName username");

    return successResponse(res, 200, comments,
      { page, limit, total, pages: Math.ceil(total / limit) },
      "Comments list"
    );
  } catch (error) {
    next(error);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return errorResponse(res, 404, "Comment not found", "NOT_FOUND");
    }

    // Only the comment author or an admin can delete
    if (comment.userId.toString() !== req.user.userId && req.user.role !== "admin") {
      return errorResponse(res, 403, "Not authorized to delete this comment", "FORBIDDEN");
    }

    await Comment.findByIdAndDelete(commentId);
    await Recipe.findByIdAndUpdate(comment.recipeId, { $inc: { commentCount: -1 } });

    return successResponse(res, 200, null, null, "Comment deleted");
  } catch (error) {
    next(error);
  }
};

// ─── SAVE / BOOKMARK ──────────────────────────────────

const saveRecipe = async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    const userId = req.user.userId;

    const existing = await Save.findOne({ userId, recipeId });
    if (existing) {
      return errorResponse(res, 400, "Already saved", "ALREADY_SAVED");
    }

    await Save.create({ userId, recipeId });
    await Recipe.findByIdAndUpdate(recipeId, { $inc: { saveCount: 1 } });

    return successResponse(res, 201, null, null, "Recipe saved");
  } catch (error) {
    next(error);
  }
};

const unsaveRecipe = async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    const userId = req.user.userId;

    const deleted = await Save.findOneAndDelete({ userId, recipeId });
    if (!deleted) {
      return errorResponse(res, 404, "Save not found", "NOT_FOUND");
    }

    await Recipe.findByIdAndUpdate(recipeId, { $inc: { saveCount: -1 } });
    return successResponse(res, 200, null, null, "Recipe unsaved");
  } catch (error) {
    next(error);
  }
};

const getSavedRecipes = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const saves = await Save.find({ userId })
      .sort("-createdAt")
      .populate({
        path: "recipeId",
        select: "title slug mainImage authorId likeCount commentCount",
        populate: { path: "authorId", select: "firstName lastName username" },
      });

    const recipes = saves.map((s) => s.recipeId).filter(Boolean);
    return successResponse(res, 200, recipes, null, "Saved recipes");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  followUser,
  unfollowUser,
  acceptFollowRequest,
  rejectFollowRequest,
  getFollowers,
  getFollowing,
  getPendingRequests,
  likeRecipe,
  unlikeRecipe,
  addComment,
  getComments,
  deleteComment,
  saveRecipe,
  unsaveRecipe,
  getSavedRecipes,
};
