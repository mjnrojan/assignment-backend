const mongoose = require("mongoose");

const SaveSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "RNUser", required: true },
    recipeId: { type: mongoose.Schema.Types.ObjectId, ref: "Recipe", required: true },
  },
  { timestamps: true }
);

// One save per user per recipe
SaveSchema.index({ userId: 1, recipeId: 1 }, { unique: true });
// Fast lookup of a user's saved recipes
SaveSchema.index({ userId: 1, createdAt: -1 });

module.exports =
  mongoose.models.Save || mongoose.model("Save", SaveSchema);
