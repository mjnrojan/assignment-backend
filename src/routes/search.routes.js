const express = require("express");
const controller = require("../controllers/search.controller");

const router = express.Router();

router.get("/", controller.search);
router.get("/categories", controller.listCategories);

module.exports = router;
