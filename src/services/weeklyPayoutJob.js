// // src/services/weeklyPayoutJob.js
// const UserRank = require("../models/UserRank");
// const WeeklyPayout = require("../models/WeeklyPayout");

// async function generateWeeklyPayoutList() {
//   console.log("Weekly payout API job started...");

//   const users = await UserRank.find({});

//   const now = new Date();
//   const weekEnd = now;
//   const weekStart = new Date();
//   weekStart.setDate(weekEnd.getDate() - 7);

//   for (let user of users) {
//     await WeeklyPayout.create({
//       user: user.user,
//       pairAmount: user.pairAmount || 0,
//       bonusCash: user.bonusCash || 0,
//       weekStart,
//       weekEnd,
//     });
//   }

//   console.log("Weekly payout API job done.");
// }

// module.exports = generateWeeklyPayoutList;

const UserRank = require("../models/UserRank");
const WeeklyPayout = require("../models/WeeklyPayout");
const logMessage = require("../utils/logger");

async function generateWeeklyPayoutList() {
  logMessage("Weekly payout job started");

  const users = await UserRank.find({});

  const weekEnd = new Date();
  const weekStart = new Date();
  weekStart.setDate(weekEnd.getDate() - 7);

  for (let user of users) {
    const pairAmount = user.pairAmount || 0;
    const bonusCash = user.bonusCash || 0;

    if (pairAmount > 0 || bonusCash > 0) {
      await WeeklyPayout.create({
        user: user.user,
        pairAmount,
        bonusCash,
        weekStart,
        weekEnd,
      });

      // ✅ log when payout created
      logMessage(
        `Payout created | User: ${user.user} | Pair: ${pairAmount} | Bonus: ${bonusCash}`
      );
    }
  }

  logMessage("Weekly payout job completed");
}

module.exports = generateWeeklyPayoutList;
