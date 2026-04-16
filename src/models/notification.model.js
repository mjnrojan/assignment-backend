const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RNUser",
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RNUser",
      required: true,
    },
    type: {
      type: String,
      enum: ["FOLLOW", "FOLLOW_REQUEST", "LIKE", "COMMENT", "RECIPE_PUBLISHED"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // Could be recipeId, userId, etc.
    },
    entityModel: {
      type: String,
      enum: ["Recipe", "RNUser", "Comment"],
      required: false,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", NotificationSchema);
