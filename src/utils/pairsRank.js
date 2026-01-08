// const User = require("../models/User");
// const UserRank = require("../models/UserRank");
// const { getRankByPairs } = require("../utils/rank.utils"); 

// async function upsertUserRankByPairCount(userId, pairCount, session) {
//   const rank = getRankByPairs(pairCount || 0);

//   // No rank → remove rank record
//   if (!rank) {
//     await UserRank.deleteOne({ user: userId }).session(session);
//     return null;
//   }

//   // Existing rank record
//   const existing = await UserRank.findOne({ user: userId }).session(session);

//   const isNewRank =
//     !existing || existing.position !== rank.position;

//   // 🔥 If rank upgraded → credit bonus
//   if (isNewRank) {
//     // 1️⃣ Credit bonus cash
//     if (rank.bonusCash > 0) {
//       await User.updateOne(
//         { _id: userId },
//         {
//           $inc: {
//             walletBalance: rank.bonusCash,
//             rankIncome: rank.bonusCash,
//           },
//         },
//         { session }
//       );
//     }
//   }

//   // 2️⃣ Upsert rank record
//   await UserRank.updateOne(
//     { user: userId },
//     {
//       $set: {
//         position: rank.position,
//         rankName: rank.rankName,
//         requiredPairsPerSide: rank.requiredPairsPerSide,
//         bonusCash: rank.bonusCash,
//         reward: rank.reward,
//         pairCountAtUpdate: pairCount || 0,

//         // ✅ auto-claim if new rank
//         bonusClaimed: isNewRank ? true : existing?.bonusClaimed ?? false,
//         bonusClaimedAt: isNewRank ? new Date() : existing?.bonusClaimedAt,
//         bonusClaimedAmount: isNewRank ? rank.bonusCash : existing?.bonusClaimedAmount ?? 0,
//       },
//       $currentDate: { updatedAt: true },
//     },
//     { upsert: true, session, setDefaultsOnInsert: true }
//   );

//   return rank;
// }


// /** Find root by following referredBy chain up to top */
// async function findRootId(startUserId, session) {
//   let cur = await User.findById(startUserId).select("_id referredBy").session(session);
//   if (!cur) return null;

//   while (cur.referredBy) {
//     const next = await User.findById(cur.referredBy).select("_id referredBy").session(session);
//     if (!next) break;
//     cur = next;
//   }
//   return cur ? cur._id : null;
// }

// /**
//  * DFS to recalc pairCount:
//  * pairCount = leftPairs + rightPairs + (hasBothChildren ? 1 : 0)
//  * Also updates UserRank for every node touched.
//  */
// async function recalcPairsDFS(nodeId, session, memo = new Map()) {
//   if (!nodeId) return 0;

//   const key = String(nodeId);
//   if (memo.has(key)) return memo.get(key);

//   const node = await User.findById(nodeId)
//     .select("_id leftReferral rightReferral")
//     .session(session);

//   if (!node) return 0;

//   const leftPairs = node.leftReferral
//     ? await recalcPairsDFS(node.leftReferral, session, memo)
//     : 0;

//   const rightPairs = node.rightReferral
//     ? await recalcPairsDFS(node.rightReferral, session, memo)
//     : 0;

//   const selfPair = node.leftReferral && node.rightReferral ? 1 : 0;
//   const totalPairs = leftPairs + rightPairs + selfPair;

//   await User.updateOne(
//     { _id: node._id },
//     { $set: { pairCount: totalPairs } },
//     { session }
//   );

//   await upsertUserRankByPairCount(node._id, totalPairs, session);

//   memo.set(key, totalPairs);
//   return totalPairs;
// }

// module.exports = {
//   upsertUserRankByPairCount,
//   findRootId,
//   recalcPairsDFS,
// };



const User = require("../models/User");
const UserRank = require("../models/UserRank");
const { getRankByPairs } = require("../utils/rank.utils");
const { applyDailyPairLimit } = require("../utils/pairLimit"); // ✅ date-based limit

const PAIR_INCOME_PER_PAIR = 100; // 💰 100 per pair

// 💸 Naye pairs ke liye payment: 100 per pair, per date max 5 (applyDailyPairLimit se)
async function payPairsForUser(userId, newPairsToPay, session) {
  if (!newPairsToPay || newPairsToPay <= 0) {
    return { payablePairs: 0, skippedPairs: 0, maxLimitReached: false };
  }

  // date-based limit (per user per day max 5 paid pairs)
  const { payablePairs, skippedPairs, maxLimitReached } =
    await applyDailyPairLimit(userId, newPairsToPay, session);

  if (payablePairs > 0) {
    const amount = payablePairs * PAIR_INCOME_PER_PAIR;

    // 👉 pairAmount me paisa add karo
    await UserRank.updateOne(
      { user: userId },
      { $inc: { pairAmount: amount } },
      { session }
    );

    // (optional) agar direct wallet credit bhi chahiye to yahan karo
    // await User.updateOne(
    //   { _id: userId },
    //   { $inc: { walletBalance: amount } },
    //   { session }
    // );
  }

  return { payablePairs, skippedPairs, maxLimitReached };
}

async function upsertUserRankByPairCount(userId, pairCount, session) {
  const rank = getRankByPairs(pairCount || 0);

  // No rank → remove rank record
  if (!rank) {
    await UserRank.deleteOne({ user: userId }).session(session);
    return null;
  }

  // Existing rank record
  const existing = await UserRank.findOne({ user: userId }).session(session);

  const isNewRank = !existing || existing.position !== rank.position;

  // 🔥 If rank upgraded → credit bonus (one time)
  if (isNewRank) {
    // 1️⃣ Credit bonus cash to user
    if (rank.bonusCash > 0) {
      await User.updateOne(
        { _id: userId },
        {
          $inc: {
            walletBalance: rank.bonusCash,
            rankIncome: rank.bonusCash,
          },
        },
        { session }
      );
    }
  }

  // 2️⃣ Upsert rank record
  await UserRank.updateOne(
    { user: userId },
    {
      $set: {
        position: rank.position,
        rankName: rank.rankName,
        requiredPairsPerSide: rank.requiredPairsPerSide,
        bonusCash: rank.bonusCash,
        reward: rank.reward,
        pairCountAtUpdate: pairCount || 0,

        // ✅ auto-claim if new rank
        bonusClaimed: isNewRank ? true : existing?.bonusClaimed ?? false,
        bonusClaimedAt: isNewRank ? new Date() : existing?.bonusClaimedAt,
        bonusClaimedAmount: isNewRank
          ? rank.bonusCash
          : existing?.bonusClaimedAmount ?? 0,
      },
      $currentDate: { updatedAt: true },
    },
    { upsert: true, session, setDefaultsOnInsert: true }
  );

  return rank;
}

/** Find root by following referredBy chain up to top */
async function findRootId(startUserId, session) {
  let cur = await User.findById(startUserId)
    .select("_id referredBy")
    .session(session);
  if (!cur) return null;

  while (cur.referredBy) {
    const next = await User.findById(cur.referredBy)
      .select("_id referredBy")
      .session(session);
    if (!next) break;
    cur = next;
  }
  return cur ? cur._id : null;
}

/**
 * DFS to recalc pairCount:
 * pairCount = leftPairs + rightPairs + (hasBothChildren ? 1 : 0)
 * Also updates UserRank for every node touched.
 * 🔥 Ab iske andar hi:
 *   - nayi pairs nikal rahe hai (difference)
 *   - unpe 100/pair pay kar rahe hain (per date max 5)
 */
async function recalcPairsDFS(nodeId, session, memo = new Map()) {
  if (!nodeId) return 0;

  const key = String(nodeId);
  if (memo.has(key)) return memo.get(key);

  const node = await User.findById(nodeId)
    .select("_id leftReferral rightReferral pairCount") // ✅ pairCount bhi le rahe hain
    .session(session);

  if (!node) return 0;

  const leftPairs = node.leftReferral
    ? await recalcPairsDFS(node.leftReferral, session, memo)
    : 0;

  const rightPairs = node.rightReferral
    ? await recalcPairsDFS(node.rightReferral, session, memo)
    : 0;

  const selfPair = node.leftReferral && node.rightReferral ? 1 : 0;
  const totalPairs = leftPairs + rightPairs + selfPair;

  const prevPairCount = node.pairCount || 0;
  const newPairsToPay = Math.max(0, totalPairs - prevPairCount); // ✅ sirf naye pairs

  // pairCount hamesha update hoga (pairs always counted)
  await User.updateOne(
    { _id: node._id },
    { $set: { pairCount: totalPairs } },
    { session }
  );

  // rank update karo
  await upsertUserRankByPairCount(node._id, totalPairs, session);

  // nayi pairs ke liye 100/pair (per date max 5)
  if (newPairsToPay > 0) {
    await payPairsForUser(node._id, newPairsToPay, session);
  }

  memo.set(key, totalPairs);
  return totalPairs;
}

module.exports = {
  upsertUserRankByPairCount,
  findRootId,
  recalcPairsDFS,
};
