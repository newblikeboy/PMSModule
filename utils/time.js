const { DateTime } = require("luxon");

const IST = "Asia/Kolkata";

function todayCutoffTs(hour = 15, minute = 30) {
  const cut = DateTime.now()
    .setZone(IST)
    .set({ hour, minute, second: 0, millisecond: 0 });
  return Math.floor(cut.toSeconds());
}

function isBeforeCutoff() {
  const now = Math.floor(DateTime.now().setZone(IST).toSeconds());
  return now <= todayCutoffTs();
}

module.exports = { todayCutoffTs, isBeforeCutoff, IST };
