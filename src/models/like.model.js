const mongoose = require("mongoose");

const LikeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "RNUser", required: true },
    recipeId: { type: mongoose.Schema.Types.ObjectId, ref: "Recipe" },
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment" },
  },
  { timestamps: true }
);

// Ensure one like per user per item
LikeSchema.index({ userId: 1, recipeId: 1 }, { unique: true, sparse: true });
LikeSchema.index({ userId: 1, commentId: 1 }, { unique: true, sparse: true });

// Performance indices
LikeSchema.index({ recipeId: 1 });
LikeSchema.index({ commentId: 1 });

module.exports = mongoose.models.Like || mongoose.model("Like", LikeSchema);
