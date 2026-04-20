const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { BCRYPT_SALT_ROUNDS } = require("../config/config");

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    username: { type: String, trim: true, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    isProfessional: { type: Boolean, default: false },
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    
    // Profile fields merged from Profile model
    biography: { type: String, default: "" },
    profileImage: { type: String, default: "" },
    profileImagePublicId: { type: String, default: "" },
    socialLinks: {
      instagram: String,
      facebook: String,
      twitter: String,
      website: String,
    },
    specialisations: [{ type: String, trim: true }],
    contactEmail: { type: String, trim: true },
    businessCategory: { type: String, default: "" },

    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date },
    verificationToken: { type: String, select: false },
    refreshToken: { type: String, select: false },
  },
  { timestamps: true }
);

UserSchema.index({ resetToken: 1 });

UserSchema.pre("save", async function hashPasswordIfNeeded() {
  if (!this.isModified("passwordHash")) {
    return;
  }
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

UserSchema.methods.comparePassword = function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

module.exports = mongoose.models.RNUser || mongoose.model("RNUser", UserSchema);
