const express = require("express");
const controller = require("../controllers/notification.controller");
const verifyToken = require("../middleware/auth");

const router = express.Router();

router.use(verifyToken);

router.get("/", controller.listNotifications);
router.patch("/:id/read", controller.markRead);
router.patch("/read-all", controller.markAllRead);
router.delete("/clear", controller.clearAll);
router.delete("/:id", controller.deleteOne);

module.exports = router;
