const mongoose = require("mongoose");

const ProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "RNUser", required: true, unique: true },
    biography: { type: String, default: "" },
    profileImage: { type: String, default: "" },
    profileImagePublicId: { type: String, default: "" },
    socialLinks: {
      instagram: String,
      facebook: String,
      twitter: String,
      website: String,
    },
    // Professional-only fields
    specialisations: [{ type: String, trim: true }],
    contactEmail: { type: String, trim: true },
    businessCategory: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Profile || mongoose.model("Profile", ProfileSchema);
