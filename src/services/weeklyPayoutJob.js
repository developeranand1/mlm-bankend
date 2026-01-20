// src/services/weeklyPayoutJob.js
const UserRank = require("../models/UserRank");
const WeeklyPayout = require("../models/WeeklyPayout");

async function generateWeeklyPayoutList() {
  console.log("Weekly payout API job started...");

  const users = await UserRank.find({});

  const now = new Date();
  const weekEnd = now;
  const weekStart = new Date();
  weekStart.setDate(weekEnd.getDate() - 7);

  for (let user of users) {
    await WeeklyPayout.create({
      user: user.user,
      pairAmount: user.pairAmount || 0,
      bonusCash: user.bonusCash || 0,
      weekStart,
      weekEnd,
    });
  }

  console.log("Weekly payout API job done.");
}

module.exports = generateWeeklyPayoutList;
