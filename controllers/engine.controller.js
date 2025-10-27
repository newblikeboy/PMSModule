"use strict";

const { startEngine, stopEngine, getStatus } = require("../services/m1.service"); 
// NOTE: if your file is named m1.service.js or m1.service.js under services, adjust path.

//
// GET /admin/engine/status
//
async function getEngineStatus(req, res) {
  try {
    const s = getStatus(); // { engineOn, beforeCutoff, lastError }
    return res.json({ ok: true, status: s });
  } catch (err) {
    console.error("[getEngineStatus] ERROR", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

//
// POST /admin/engine/start
//
async function startScanEngine(req, res) {
  try {
    const resp = await startEngine();
    // resp is like { ok: true, msg: "...started N symbols" }
    return res.json(resp);
  } catch (err) {
    console.error("[startScanEngine] ERROR", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

//
// POST /admin/engine/stop
//
async function stopScanEngine(req, res) {
  try {
    const resp = await stopEngine();
    // resp is like { ok: true, msg: "stopped" }
    return res.json(resp);
  } catch (err) {
    console.error("[stopScanEngine] ERROR", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getEngineStatus,
  startScanEngine,
  stopScanEngine
};
