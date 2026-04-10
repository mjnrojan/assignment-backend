const AuditLog = require("../models/auditLog.model");

const writeAuditLog = async ({ adminId, action, targetType, targetId, details = "" }) => {
  return AuditLog.create({
    adminId,
    action,
    targetType,
    targetId,
    details,
  });
};

module.exports = {
  writeAuditLog,
};
