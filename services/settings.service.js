// services/settings.service.js
"use strict";

/*
  Global runtime toggles for admin.
  In production you'd persist to DB.
*/

const settings = {
  isPaperTradingActive: true,
  isLiveExecutionAllowed: false,
  marketHalt: false
};

function getSettings() {
  return { ...settings };
}

function setSetting(key, value) {
  if (settings.hasOwnProperty(key)) {
    settings[key] = !!value;
  }
  return getSettings();
}

module.exports = {
  getSettings,
  setSetting
};
