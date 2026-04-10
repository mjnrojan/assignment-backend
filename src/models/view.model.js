const mongoose = require("mongoose");

const ViewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "RNUser" },
    recipeId: { type: mongoose.Schema.Types.ObjectId, ref: "Recipe", required: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Unique views per user per recipe (for analytics)
ViewSchema.index({ recipeId: 1, userId: 1 });
// Time-based analytics queries
ViewSchema.index({ recipeId: 1, viewedAt: -1 });

module.exports =
  mongoose.models.View || mongoose.model("View", ViewSchema);
