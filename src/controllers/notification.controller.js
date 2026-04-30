const Notification = require("../models/notification.model");
const { successResponse, errorResponse } = require("../utils/apiResponse");

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

const deleteOne = async (req, res, next) => {
  try {
    const deleted = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipientId: req.user.userId,
    });

    if (!deleted) {
      return errorResponse(res, 404, "Notification not found", "NOT_FOUND");
    }

    return successResponse(res, 200, null, null, "Notification deleted");
  } catch (error) {
    next(error);
  }
};

const clearAll = async (req, res, next) => {
  try {
    await Notification.deleteMany({ recipientId: req.user.userId });
    return successResponse(res, 200, null, null, "All notifications cleared");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listNotifications,
  markRead,
  markAllRead,
  deleteOne,
  clearAll,
};
