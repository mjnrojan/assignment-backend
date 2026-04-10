const mongoose = require("mongoose");

const FollowSchema = new mongoose.Schema(
  {
    followerId: { type: mongoose.Schema.Types.ObjectId, ref: "RNUser", required: true },
    followingId: { type: mongoose.Schema.Types.ObjectId, ref: "RNUser", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "accepted",
    },
  },
  { timestamps: true }
);

// Prevent duplicate follows
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
// Fast lookups for follower/following lists
FollowSchema.index({ followingId: 1, status: 1 });
FollowSchema.index({ followerId: 1, status: 1 });

module.exports =
  mongoose.models.Follow || mongoose.model("Follow", FollowSchema);
