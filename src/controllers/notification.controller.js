const Notification = require("../models/notification.model");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * List notifications for current user
 */
const listNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user.userId })
      .populate("actorId", "firstName lastName username profileImage")
      .sort({ createdAt: -1 })
      .limit(50);

    return successResponse(res, 200, { notifications }, null, "Notifications retrieved");
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read
 */
const markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user.userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return errorResponse(res, 404, "Notification not found", "NOT_FOUND");
    }

    return successResponse(res, 200, { notification }, null, "Notification marked as read");
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all visible notifications as read
 */
const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user.userId, isRead: false },
      { isRead: true }
    );
    return successResponse(res, 200, null, null, "All notifications marked as read");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listNotifications,
  markRead,
  markAllRead,
};
