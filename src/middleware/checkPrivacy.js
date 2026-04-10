const Follow = require("../models/follow.model");
const User = require("../models/user.model");

/**
 * Middleware to check if the requesting user can view content from a target user.
 * - Public accounts: everyone can see.
 * - Private accounts: only accepted followers can see.
 * Expects req.params.userId as the target user.
 * Sets req.canViewContent = true/false.
 */
const checkPrivacy = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    const requesterId = req.user?.userId;

    // If viewing your own content, always allow
    if (requesterId && requesterId === targetUserId) {
      req.canViewContent = true;
      return next();
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Public account — everyone can see
    if (!targetUser.isPrivate) {
      req.canViewContent = true;
      return next();
    }

    // Private account — check if requester is an accepted follower
    if (!requesterId) {
      req.canViewContent = false;
      return next();
    }

    const follow = await Follow.findOne({
      followerId: requesterId,
      followingId: targetUserId,
      status: "accepted",
    });

    req.canViewContent = Boolean(follow);
    return next();
  } catch (error) {
    next(error);
  }
};

module.exports = checkPrivacy;
