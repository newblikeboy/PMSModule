"use strict";

/*
  Global runtime toggles for admin.
  In production you'd persist to DB.
*/

const settings = {
  isPaperTradingActive: true,
  isLiveExecutionAllowed: false,
  marketHalt: false,
  // per-user allowed margin percent (0..1)
  userMargins: { default: 0.5 }, // default 50%
};

function getSettings() {
  return { ...settings };
}

function setSetting(key, value) {
  if (Object.prototype.hasOwnProperty.call(settings, key)) {
    settings[key] = value;
  }
  return getSettings();
}

// get or set allowed margin % per user (0..1)
function getUserAllowedMargin(userId = "default") {
  const v = settings.userMargins?.[userId];
  if (typeof v === "number" && v >= 0 && v <= 1) return v;
  return settings.userMargins.default ?? 0.5;
}

function setUserAllowedMargin(userId, percent) {
  if (!settings.userMargins) settings.userMargins = {};
  const p = Math.max(0, Math.min(1, Number(percent)));
  settings.userMargins[userId] = p;
  return getUserAllowedMargin(userId);
}

module.exports = {
  getSettings,
  setSetting,
  getUserAllowedMargin,
  setUserAllowedMargin,
};
