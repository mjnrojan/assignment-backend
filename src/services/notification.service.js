const Notification = require("../models/notification.model");
const Follow = require("../models/follow.model");
const User = require("../models/user.model");

/**
 * Types where only one notification should ever exist per actor→recipient→entity.
 * Re-triggering the action replaces the old notification (reset to unread).
 */
const UPSERT_TYPES = new Set(["FOLLOW", "FOLLOW_REQUEST", "LIKE", "COMMENT"]);

/**
 * Create or replace a notification.
 * - Deduplicatable types use upsert so re-doing an action (unlike→like, unfollow→follow)
 *   never stacks duplicate notifications.
 * - RECIPE_PUBLISHED always creates a new doc (each publish is a distinct event).
 */
const createNotification = async ({ recipientId, actorId, type, entityId, entityModel, message }) => {
  try {
    if (recipientId.toString() === actorId.toString()) return null;

    if (UPSERT_TYPES.has(type)) {
      // FOLLOW / FOLLOW_REQUEST: one per actor-recipient pair (no entityId in filter)
      // LIKE / COMMENT: one per actor-recipient-recipe pair
      const filter = { recipientId, actorId, type };
      if (entityId && type !== "FOLLOW" && type !== "FOLLOW_REQUEST") {
        filter.entityId = entityId;
      }

      return await Notification.findOneAndUpdate(
        filter,
        { $set: { message, entityId, entityModel, isRead: false } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    return await Notification.create({ recipientId, actorId, type, entityId, entityModel, message });
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
};

/**
 * Remove notifications when the triggering action is undone (unlike, unfollow).
 * Pass `types` (array) to delete multiple types at once (e.g. FOLLOW + FOLLOW_REQUEST).
 */
const deleteNotification = async ({ actorId, recipientId, type, types, entityId }) => {
  try {
    const filter = { actorId };
    if (recipientId) filter.recipientId = recipientId;
    if (types?.length) filter.type = { $in: types };
    else if (type) filter.type = type;
    if (entityId) filter.entityId = entityId;
    await Notification.deleteMany(filter);
  } catch (error) {
    console.error("Failed to delete notification:", error);
  }
};

/**
 * Notify all followers when a user publishes a recipe.
 */
const notifyFollowers = async (authorId, recipe) => {
  try {
    const followers = await Follow.find({ followingId: authorId, status: "accepted" });
    const actor = await User.findById(authorId);

    const notifications = followers.map((f) => ({
      recipientId: f.followerId,
      actorId: authorId,
      type: "RECIPE_PUBLISHED",
      entityId: recipe._id,
      entityModel: "Recipe",
      message: `${actor.firstName} published a new recipe: ${recipe.title}`,
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error("Failed to notify followers:", error);
  }
};

module.exports = { createNotification, deleteNotification, notifyFollowers };
