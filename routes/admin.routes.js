const express = require("express");
const router = express.Router();
const adminRequired = require("../middlewares/adminRequired");
const adminCtrl = require("../controllers/admin.controller");

const {
  getEngineStatus,
  startScanEngine,
  stopScanEngine
} = require("../controllers/engine.controller");


// overview
router.get("/overview", adminRequired, adminCtrl.getOverview);

// signals (reuse m2 service directly through controller? we'll handle via controller below)
router.get("/signals", adminRequired, async (req, res, next) => {
  try {
    const m2Service = require("../services/m2.service");
    const result = await m2Service.getLatestSignalsFromDB();
    res.json(result);
  } catch (err) {
    next(err);
  }
});



// trades list (paper)
router.get("/trades", adminRequired, async (req,res,next)=>{
  try {
    const tradeEngine = require("../services/tradeEngine.service");
    const result = await tradeEngine.getAllTrades();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// users
router.get("/users", adminRequired, adminCtrl.getUsers);
router.post("/user/plan", adminRequired, adminCtrl.setUserPlan);
router.post("/user/automation", adminRequired, adminCtrl.setUserAutomation);

// system control
router.get("/system", adminRequired, adminCtrl.getSystemSettings);
router.post("/system", adminRequired, adminCtrl.updateSystemSetting);

// Engine Control (M1 live scanner)
router.get("/engine/status", adminRequired, getEngineStatus);

router.post("/engine/start", adminRequired, async (req, res) => {
  return startScanEngine(req, res);
});

router.post("/engine/stop", adminRequired, async (req, res) => {
  return stopScanEngine(req, res);
});


module.exports = router;
