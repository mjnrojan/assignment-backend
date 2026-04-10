const mongoose = require("mongoose");

const LikeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "RNUser", required: true },
    recipeId: { type: mongoose.Schema.Types.ObjectId, ref: "Recipe", required: true },
  },
  { timestamps: true }
);

// One like per user per recipe
LikeSchema.index({ userId: 1, recipeId: 1 }, { unique: true });
// Fast count of likes on a recipe
LikeSchema.index({ recipeId: 1 });

module.exports =
  mongoose.models.Like || mongoose.model("Like", LikeSchema);
