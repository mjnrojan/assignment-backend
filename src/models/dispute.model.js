const mongoose = require("mongoose");

const DisputeSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RNUser",
      required: true,
    },
    recipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: false, // Optional if reporting a user directly, but required for content
    },
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      required: false,
    },
    targetType: {
      type: String,
      enum: ["Recipe", "Comment"],
      required: true,
      default: "Recipe",
    },
    reason: {
      type: String,
      enum: ["Copyright", "Spam", "Inappropriate Content", "Harassment", "Other"],
      required: true,
    },
    details: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "investigating", "resolved", "dismissed"],
      default: "pending",
    },
    resolution: {
      actionTaken: { type: String, enum: ["None", "Content Removed", "Account Suspended", "Warning Issued"] },
      notes: { type: String },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "RNUser" },
      resolvedAt: { type: Date },
    },
  },
  { timestamps: true }
);

DisputeSchema.index({ status: 1 });
DisputeSchema.index({ recipeId: 1 });

module.exports = mongoose.model("Dispute", DisputeSchema);
