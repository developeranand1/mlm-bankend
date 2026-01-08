// utils/pairLimit.js
const User = require("../models/User");

/**
 * Returns today's midnight date (00:00:00) based on server local time.
 */
function getTodayMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Make sure user's daily counter is for today.
 * If lastPairPaidDate < today's midnight => reset dailyPairPaid and maxLimitReached.
 */
function resetDailyLimitIfNeeded(user) {
  const todayMidnight = getTodayMidnight();

  if (!user.lastPairPaidDate || user.lastPairPaidDate < todayMidnight) {
    user.dailyPairPaid = 0;
    user.maxLimitReached = false;
  }
}

/**
 * Apply daily 5-pair limit.
 * - pairsToPay: number of new pairs we *could* pay (based on pairCount logic).
 * - returns how many we are actually allowed to pay now.
 */
async function applyDailyPairLimit(userId, pairsToPay, session) {
  const user = await User.findById(userId).session(session);

  if (!user) throw new Error("User not found");

  resetDailyLimitIfNeeded(user);

  const DAILY_LIMIT = 5;
  const remaining = DAILY_LIMIT - user.dailyPairPaid;

  // If already maxed out, no pairs are paid
  if (remaining <= 0) {
    user.maxLimitReached = true;
    await user.save({ session });
    return {
      payablePairs: 0,
      skippedPairs: pairsToPay,
      maxLimitReached: true,
    };
  }

  // How many pairs can we pay now
  const payablePairs = Math.min(remaining, pairsToPay);

  // Update user counts
  user.dailyPairPaid += payablePairs;
  user.pairPaid += payablePairs;         // lifetime counter
  user.lastPairPaidDate = new Date();

  if (user.dailyPairPaid >= DAILY_LIMIT) {
    user.maxLimitReached = true;
  }

  await user.save({ session });

  return {
    payablePairs,
    skippedPairs: pairsToPay - payablePairs,
    maxLimitReached: user.maxLimitReached,
  };
}

module.exports = {
  applyDailyPairLimit,
};
