const User = require("../models/user.model");
const Follow = require("../models/follow.model");
const Like = require("../models/like.model");
const Comment = require("../models/comment.model");
const Save = require("../models/save.model");
const Recipe = require("../models/recipe.model");
const { createNotification } = require("../services/notification.service");
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

    // Trigger Notification
    const actor = await User.findById(followerId);
    await createNotification({
      recipientId: targetId,
      actorId: followerId,
      type: status === "accepted" ? "FOLLOW" : "FOLLOW_REQUEST",
      entityId: followerId,
      entityModel: "RNUser",
      message: status === "accepted" 
        ? `${actor.firstName} followed you` 
        : `${actor.firstName} requested to follow you`
    });

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

    // Notify the follower that their request was accepted
    const actor = await User.findById(follow.followingId);
    await createNotification({
      recipientId: follow.followerId,
      actorId: follow.followingId,
      type: "FOLLOW",
      entityId: follow.followingId,
      entityModel: "RNUser",
      message: `${actor.firstName} accepted your follow request`
    });

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
    const recipe = await Recipe.findByIdAndUpdate(recipeId, { $inc: { likeCount: 1 } });

    // Notify Author
    const actor = await User.findById(userId);
    await createNotification({
      recipientId: recipe.authorId,
      actorId: userId,
      type: "LIKE",
      entityId: recipeId,
      entityModel: "Recipe",
      message: `${actor.firstName} liked your recipe: ${recipe.title}`
    });

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

const likeComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;

    const existing = await Like.findOne({ userId, commentId });
    if (existing) {
      return errorResponse(res, 400, "Comment already liked", "ALREADY_LIKED");
    }

    await Like.create({ userId, commentId });
    const comment = await Comment.findByIdAndUpdate(commentId, { $inc: { likeCount: 1 } });
    if (!comment) return errorResponse(res, 404, "Comment not found", "NOT_FOUND");

    return successResponse(res, 201, null, null, "Comment liked");
  } catch (error) {
    next(error);
  }
};

const unlikeComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;

    const deleted = await Like.findOneAndDelete({ userId, commentId });
    if (!deleted) {
      return errorResponse(res, 404, "Like not found", "NOT_FOUND");
    }

    await Comment.findByIdAndUpdate(commentId, { $inc: { likeCount: -1 } });
    return successResponse(res, 200, null, null, "Comment like removed");
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

    // Double Submit Protection
    const recentDuplicate = await Comment.findOne({
      userId: req.user.userId,
      recipeId,
      text: text.trim(),
      createdAt: { $gte: new Date(Date.now() - 10 * 1000) } // Last 10 seconds
    });

    if (recentDuplicate) {
      return errorResponse(res, 400, "Duplicate comment detected. Please wait.", "DOUBLE_SUBMIT");
    }

    const comment = await Comment.create({
      userId: req.user.userId,
      recipeId,
      text: text.trim(),
    });

    const recipe = await Recipe.findByIdAndUpdate(recipeId, { $inc: { commentCount: 1 } });

    // Notify Author
    const actor = await User.findById(req.user.userId);
    await createNotification({
      recipientId: recipe.authorId,
      actorId: req.user.userId,
      type: "COMMENT",
      entityId: recipeId,
      entityModel: "Recipe",
      message: `${actor.firstName} commented on your recipe: ${recipe.title}`
    });

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
    const { sortBy = "newest", page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Determine sort order
    let sortCriteria = "-createdAt"; // Default newest
    if (sortBy === "oldest") sortCriteria = "createdAt";
    if (sortBy === "popular") sortCriteria = "-likeCount -createdAt";

    const total = await Comment.countDocuments({ recipeId });
    const comments = await Comment.find({ recipeId })
      .sort(sortCriteria)
      .skip(skip)
      .limit(Number(limit))
      .populate("userId", "firstName lastName username profileImage");

    return successResponse(res, 200, comments,
      { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
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

const Dispute = require("../models/dispute.model");

const fileDispute = async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    const { reason, details } = req.body;

    if (!reason || !details) {
      return errorResponse(res, 400, "Reason and details are required", "VALIDATION_ERROR");
    }

    // Prevention: User cannot file same dispute twice for same recipe
    const existing = await Dispute.findOne({
      reporterId: req.user.userId,
      recipeId,
      targetType: "Recipe",
      status: { $ne: "resolved" }
    });

    if (existing) {
      return errorResponse(res, 400, "You have already filed a report for this recipe.", "ALREADY_REPORTED");
    }

    const dispute = await Dispute.create({
      reporterId: req.user.userId,
      recipeId,
      reason,
      details,
    });

    // Mark the recipe as flagged so admins see it in their moderation queue immediately
    await Recipe.findByIdAndUpdate(recipeId, { isFlagged: true });

    return successResponse(res, 201, dispute, null, "Dispute filed and sent to moderation");
  } catch (error) {
    next(error);
  }
};

const fileCommentDispute = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { reason, details } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) return errorResponse(res, 404, "Comment not found", "NOT_FOUND");

    // Prevention: User cannot report same comment twice
    const existing = await Dispute.findOne({
      reporterId: req.user.userId,
      commentId,
      targetType: "Comment",
      status: { $ne: "resolved" }
    });

    if (existing) {
      return errorResponse(res, 400, "You have already reported this comment.", "ALREADY_REPORTED");
    }

    const dispute = await Dispute.create({
      reporterId: req.user.userId,
      recipeId: comment.recipeId,
      commentId,
      targetType: "Comment",
      reason,
      details,
    });

    return successResponse(res, 201, dispute, null, "Comment reported and sent to moderation");
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
  likeComment,
  unlikeComment,
  addComment,
  getComments,
  deleteComment,
  saveRecipe,
  unsaveRecipe,
  getSavedRecipes,
  fileDispute,
  fileCommentDispute,
};
