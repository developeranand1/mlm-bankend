// jobs/weeklyPairPayout.js
const cron = require("node-cron");
const mongoose = require("mongoose");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const PairPayoutLedger = require("../models/PairPayoutLedger");

// helper: IST week range for payout
function getLastWeekRangeIST(now = new Date()) {
  // simple approach: payout on Sunday, so compute previous Sunday 00:00 to Saturday 23:59
  // NOTE: for production, use a proper timezone lib (luxon/dayjs-timezone).
  const end = new Date(now);
  end.setHours(0, 0, 0, 0); // today 00:00
  // go to previous Sunday 00:00 if today is Sunday, end is Sunday 00:00
  const day = end.getDay(); // 0 Sunday
  const start = new Date(end);
  start.setDate(end.getDate() - 7); // last week start (Sunday 00:00)
  return { weekStart: start, weekEnd: end };
}

async function runWeeklyPairPayout() {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { weekStart, weekEnd } = getLastWeekRangeIST(new Date());

    // per pair rate (example)
    const PAIR_AMOUNT = 100; // change as per plan

    const users = await User.find({ role: "User" }).session(session);

    for (const u of users) {
      const minSide = Math.min(u.leftCount, u.rightCount);
      const availablePairs = minSide - u.pairPaid;

      if (availablePairs <= 0) continue;

      const amount = availablePairs * PAIR_AMOUNT;

      // prevent double payout for same week by ledger unique index
      await PairPayoutLedger.create(
        [
          {
            user: u._id,
            weekStart,
            weekEnd,
            pairsPaidNow: availablePairs,
            amount,
            leftCountSnapshot: u.leftCount,
            rightCountSnapshot: u.rightCount,
            pairPaidSnapshotBefore: u.pairPaid,
          },
        ],
        { session }
      );

      // update user paid pairs + earnings
      u.pairPaid += availablePairs;
      u.earnings += amount;
      await u.save({ session });

      // credit wallet
      await Wallet.findOneAndUpdate(
        { user: u._id },
        { $inc: { balance: amount } },
        { upsert: true, session }
      );
    }

    await session.commitTransaction();
    session.endSession();
    console.log("Weekly pair payout done:", weekStart, weekEnd);
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    console.error("Weekly payout failed:", e.message);
  }
}

// Every Sunday 00:05 (server should be IST; otherwise use timezone handling)
cron.schedule("5 0 * * 0", runWeeklyPairPayout);

module.exports = { runWeeklyPairPayout };
