const cron = require("node-cron");
const generateWeeklyPayoutList = require("../services/weeklyPayoutJob");

console.log("Weekly payout cron initialized");

// ⏰ Every Saturday at 23:00 (11 PM)
cron.schedule("0 23 * * 6", async () => {
  try {
    console.log("Weekly payout cron started...");
    await generateWeeklyPayoutList();
    console.log("Weekly payout cron finished successfully");
  } catch (err) {
    console.error("Weekly payout cron failed:", err);
  }
});
