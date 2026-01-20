// utils/pairLimit.js
const User = require("../models/User");

const DAILY_LIMIT = 5;

function getTodayMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function resetDailyLimitIfNeeded(user) {
  const todayMidnight = getTodayMidnight();

  if (!user.lastPairPaidDate || user.lastPairPaidDate < todayMidnight) {
    user.dailyPairPaid = 0;
    user.maxLimitReached = false;
  }
}


async function applyDailyPairLimit(userId, pairsToPay, session) {
  const user = await User.findById(userId).session(session);
  if (!user) throw new Error("User not found");

  resetDailyLimitIfNeeded(user);

  const remaining = DAILY_LIMIT - user.dailyPairPaid;

  if (remaining <= 0) {
    user.maxLimitReached = true;
    await user.save({ session });
    return {
      payablePairs: 0,
      skippedPairs: pairsToPay,
      maxLimitReached: true,
    };
  }

  const payablePairs = Math.min(remaining, pairsToPay);

  user.dailyPairPaid += payablePairs;
  user.pairPaid += payablePairs;      // lifetime paid pairs
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

