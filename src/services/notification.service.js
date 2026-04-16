const Notification = require("../models/notification.model");
const Follow = require("../models/follow.model");
const User = require("../models/user.model");

/**
 * Utility to create a notification
 */
const createNotification = async ({ 
  recipientId, 
  actorId, 
  type, 
  entityId, 
  entityModel, 
  message 
}) => {
  try {
    if (recipientId.toString() === actorId.toString()) {
      return null;
    }

    return await Notification.create({
      recipientId,
      actorId,
      type,
      entityId,
      entityModel,
      message
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
};

/**
 * Notify all followers when a user publishes a recipe
 */
const notifyFollowers = async (authorId, recipe) => {
  try {
    const followers = await Follow.find({ followingId: authorId, status: "accepted" });
    const actor = await User.findById(authorId);
    
    const notifications = followers.map(f => ({
      recipientId: f.followerId,
      actorId: authorId,
      type: "RECIPE_PUBLISHED",
      entityId: recipe._id,
      entityModel: "Recipe",
      message: `${actor.firstName} published a new recipe: ${recipe.title}`
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error("Failed to notify followers:", error);
  }
};

module.exports = {
  createNotification,
  notifyFollowers,
};
