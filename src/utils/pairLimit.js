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

/**
 * Apply daily 5-pair limit for a user.
 * - pairsToPay = new pairs that *could* be paid.
 * - returns: payablePairs (0..pairsToPay), skippedPairs, maxLimitReached
 */
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



// // utils/pairLimit.js
// const User = require("../models/User");

// // ✅ yahan se testing control kar sakte ho
// // 1 minute = har 1 minute baad limit reset
// // 5 minute chahiye to 5 kar do, etc.
// const TEST_RESET_MINUTES = 1;

// const DAILY_LIMIT = 5; // max 5 pairs per window (abhi 1 min ka window)

// function getResetTimeFrom(now) {
//   // abhi se TEST_RESET_MINUTES pehle ka time
//   return new Date(now.getTime() - TEST_RESET_MINUTES * 60 * 1000);
// }

// // ⚙️ agar lastPairPaidDate purane window ka hai to counter reset
// function resetDailyLimitIfNeeded(user) {
//   const now = new Date();
//   const resetTime = getResetTimeFrom(now);

//   if (!user.lastPairPaidDate || user.lastPairPaidDate < resetTime) {
//     // naya window shuru
//     user.dailyPairPaid = 0;
//     user.maxLimitReached = false;
//   }
// }

// /**
//  * Apply 5-pair limit per TEST_RESET_MINUTES
//  * - pairsToPay: jitne naye pairs pay kar sakte the
//  * return: { payablePairs, skippedPairs, maxLimitReached }
//  */
// async function applyDailyPairLimit(userId, pairsToPay, session) {
//   const user = await User.findById(userId).session(session);
//   if (!user) throw new Error("User not found");

//   // window check + reset if needed
//   resetDailyLimitIfNeeded(user);

//   const remaining = DAILY_LIMIT - user.dailyPairPaid;

//   if (remaining <= 0) {
//     user.maxLimitReached = true;
//     await user.save({ session });
//     return {
//       payablePairs: 0,
//       skippedPairs: pairsToPay,
//       maxLimitReached: true,
//     };
//   }

//   const payablePairs = Math.min(remaining, pairsToPay);

//   user.dailyPairPaid += payablePairs;   // is window me kitne pay hue
//   user.pairPaid += payablePairs;        // lifetime paid pairs
//   user.lastPairPaidDate = new Date();

//   if (user.dailyPairPaid >= DAILY_LIMIT) {
//     user.maxLimitReached = true;
//   }

//   await user.save({ session });

//   return {
//     payablePairs,
//     skippedPairs: pairsToPay - payablePairs,
//     maxLimitReached: user.maxLimitReached,
//   };
// }

// module.exports = {
//   applyDailyPairLimit,
// };
