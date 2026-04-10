const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "RNUser", required: true },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, enum: ["User", "Recipe"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    details: { type: String, default: "" },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AuditLogSchema.index({ adminId: 1 });
AuditLogSchema.index({ createdAt: 1 });
AuditLogSchema.index({ action: 1 });

module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
