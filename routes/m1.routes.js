const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/m1.controller");

router.get("/status", ctrl.status);
router.post("/start", ctrl.start);
router.post("/stop", ctrl.stop);
router.get("/movers", ctrl.movers);

module.exports = router;
