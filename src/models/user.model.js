const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    username: { type: String, trim: true, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    isProfessional: { type: Boolean, default: false },
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    resetToken: { type: String, select: false },
    resetTokenExpiry: { type: Date },
    verificationToken: { type: String, select: false },
  },
  { timestamps: true }
);

UserSchema.index({ resetToken: 1 });

UserSchema.pre("save", async function hashPasswordIfNeeded() {
  if (!this.isModified("passwordHash")) {
    return;
  }
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

UserSchema.methods.comparePassword = function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

module.exports = mongoose.models.RNUser || mongoose.model("RNUser", UserSchema);
