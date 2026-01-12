const cron = require("node-cron");
const UserRank = require("../models/UserRank");
const WeeklyPayout = require("../models/WeeklyPayout");

// ⏰ Har Sunday 23:59 (11:59 PM) ko chalega
cron.schedule("59 23 * * 0", async () => {
  console.log("Weekly payout job started...");

  try {
    const users = await UserRank.find({});

    const now = new Date();
    const weekEnd = now;
    const weekStart = new Date();
    weekStart.setDate(weekEnd.getDate() - 7);

    for (let user of users) {
      const payoutAmount = (user.pairAmount || 0) + (user.bonusCash || 0);

      await WeeklyPayout.create({
        user: user.user,
        pairAmount: user.pairAmount,
        bonusCash: user.bonusCash,
        payoutAmount,
        weekStart,
        weekEnd,
      });
    }

    console.log("Weekly payout job done.");
  } catch (err) {
    console.error("Error in weekly payout job:", err);
  }
});


// const cron = require("node-cron");
// const runWeeklyPayoutJob = require("../services/weeklyPayoutJob");

// // Runs every Sunday 23:59 (11:59 PM)
// cron.schedule("59 23 * * 0", async () => {
//   await runWeeklyPayoutJob();
// });

