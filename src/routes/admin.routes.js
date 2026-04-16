const express = require("express");
const controller = require("../controllers/admin.controller");
const verifyToken = require("../middleware/auth");
const verifyAdmin = require("../middleware/verifyAdmin");

const router = express.Router();

router.use(verifyToken, verifyAdmin);

router.get("/users", controller.listUsers);
router.get("/users/:userId", controller.getUserById);
router.patch("/users/:userId/suspend", controller.suspendUser);
router.patch("/users/:userId/reinstate", controller.reinstateUser);
router.delete("/users/:userId", controller.deleteUser);

router.get("/content", controller.listContent);
router.patch("/content/:contentId/approve", controller.approveContent);
router.patch("/content/:contentId/reject", controller.rejectContent);
router.delete("/content/:contentId", controller.deleteContent);

router.get("/audit-log", controller.auditLog);
router.get("/dashboard-stats", controller.dashboardStats);
router.get("/disputes", controller.listDisputes);
router.patch("/disputes/:disputeId/resolve", controller.resolveDispute);

module.exports = router;
