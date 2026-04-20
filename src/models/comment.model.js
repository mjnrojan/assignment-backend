const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "RNUser", required: true },
    recipeId: { type: mongoose.Schema.Types.ObjectId, ref: "Recipe", required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    likeCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CommentSchema.index({ recipeId: 1, createdAt: -1 });

module.exports =
  mongoose.models.Comment || mongoose.model("Comment", CommentSchema);
