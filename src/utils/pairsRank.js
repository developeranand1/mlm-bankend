

// const User = require("../models/User");
// const UserRank = require("../models/UserRank");
// const { getRankByPairs } = require("../utils/rank.utils");
// const { applyDailyPairLimit } = require("../utils/pairLimit"); // ✅ date-based limit

// const PAIR_INCOME_PER_PAIR = 100; // 💰 100 per pair

// // 💸 Naye pairs ke liye payment: 100 per pair, per date max 5 (applyDailyPairLimit se)
// async function payPairsForUser(userId, newPairsToPay, session) {
//   if (!newPairsToPay || newPairsToPay <= 0) {
//     return { payablePairs: 0, skippedPairs: 0, maxLimitReached: false };
//   }

//   // date-based limit (per user per day max 5 paid pairs)
//   const { payablePairs, skippedPairs, maxLimitReached } =
//     await applyDailyPairLimit(userId, newPairsToPay, session);

//   if (payablePairs > 0) {
//     const amount = payablePairs * PAIR_INCOME_PER_PAIR;

//     // 👉 pairAmount me paisa add karo
//     await UserRank.updateOne(
//       { user: userId },
//       { $inc: { pairAmount: amount } },
//       { session }
//     );

//     // (optional) agar direct wallet credit bhi chahiye to yahan karo
//     // await User.updateOne(
//     //   { _id: userId },
//     //   { $inc: { walletBalance: amount } },
//     //   { session }
//     // );
//   }

//   return { payablePairs, skippedPairs, maxLimitReached };
// }

// async function upsertUserRankByPairCount(userId, pairCount, session) {
//   const rank = getRankByPairs(pairCount || 0);

//   // No rank → remove rank record
//   if (!rank) {
//     await UserRank.deleteOne({ user: userId }).session(session);
//     return null;
//   }

//   // Existing rank record
//   const existing = await UserRank.findOne({ user: userId }).session(session);

//   const isNewRank = !existing || existing.position !== rank.position;

//   // 🔥 If rank upgraded → credit bonus (one time)
//   if (isNewRank) {
//     // 1️⃣ Credit bonus cash to user
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
//         bonusClaimedAmount: isNewRank
//           ? rank.bonusCash
//           : existing?.bonusClaimedAmount ?? 0,
//       },
//       $currentDate: { updatedAt: true },
//     },
//     { upsert: true, session, setDefaultsOnInsert: true }
//   );

//   return rank;
// }

// /** Find root by following referredBy chain up to top */
// async function findRootId(startUserId, session) {
//   let cur = await User.findById(startUserId)
//     .select("_id referredBy")
//     .session(session);
//   if (!cur) return null;

//   while (cur.referredBy) {
//     const next = await User.findById(cur.referredBy)
//       .select("_id referredBy")
//       .session(session);
//     if (!next) break;
//     cur = next;
//   }
//   return cur ? cur._id : null;
// }

// /**
//  * DFS to recalc pairCount:
//  * pairCount = leftPairs + rightPairs + (hasBothChildren ? 1 : 0)
//  * Also updates UserRank for every node touched.
//  * 🔥 Ab iske andar hi:
//  *   - nayi pairs nikal rahe hai (difference)
//  *   - unpe 100/pair pay kar rahe hain (per date max 5)
//  */
// async function recalcPairsDFS(nodeId, session, memo = new Map()) {
//   if (!nodeId) return 0;

//   const key = String(nodeId);
//   if (memo.has(key)) return memo.get(key);

//   const node = await User.findById(nodeId)
//     .select("_id leftReferral rightReferral pairCount") // ✅ pairCount bhi le rahe hain
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

//   const prevPairCount = node.pairCount || 0;
//   const newPairsToPay = Math.max(0, totalPairs - prevPairCount); // ✅ sirf naye pairs

//   // pairCount hamesha update hoga (pairs always counted)
//   await User.updateOne(
//     { _id: node._id },
//     { $set: { pairCount: totalPairs } },
//     { session }
//   );

//   // rank update karo
//   await upsertUserRankByPairCount(node._id, totalPairs, session);

//   // nayi pairs ke liye 100/pair (per date max 5)
//   if (newPairsToPay > 0) {
//     await payPairsForUser(node._id, newPairsToPay, session);
//   }

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
 * Helper: count pairs for ONE user using "full levels only" rule.
 *
 * Rule:
 *  - BFS from this user as root.
 *  - Track left-side and right-side node counts.
 *  - Levels:
 *      * As long as EVERY node on a level has both children,
 *        we allow going deeper.
 *      * At the FIRST level where ANY node is missing left/right child,
 *        we still count nodes on that level, but we DO NOT go deeper.
 *  - pairCount = min(effectiveLeftNodes, effectiveRightNodes)
 */
async function computePairsUsingFullLevels(rootId, session) {
  const root = await User.findById(rootId)
    .select("leftReferral rightReferral")
    .session(session);

  if (!root) return 0;

  const queue = [];

  if (root.leftReferral) {
    queue.push({
      id: root.leftReferral,
      depth: 1,
      side: "left",
    });
  }

  if (root.rightReferral) {
    queue.push({
      id: root.rightReferral,
      depth: 1,
      side: "right",
    });
  }

  let depthLimit = Infinity; // jis depth pe pehli baar incomplete node mile
  let effectiveLeft = 0;
  let effectiveRight = 0;

  while (queue.length > 0) {
    const { id, depth, side } = queue.shift();

    // agar depthLimit set ho chuka hai, uske niche wale nodes ignore honge
    if (depth > depthLimit) continue;

    // is node ko side ke count me add karo
    if (side === "left") effectiveLeft++;
    else effectiveRight++;

    // agar ye hi limiting depth hai, children ko explore mat karo
    if (depth === depthLimit) continue;

    const node = await User.findById(id)
      .select("leftReferral rightReferral")
      .session(session);

    if (!node) continue;

    const hasLeft = !!node.leftReferral;
    const hasRight = !!node.rightReferral;

    // agar node ke dono child nahi hai -> ye level se aage count nahi karna
    if (!hasLeft || !hasRight) {
      if (depthLimit === Infinity) {
        depthLimit = depth; // yahi last depth hai jahan tak count allowed hai
      }
      // is node ke children ko queue me mat daalo
      continue;
    }

    // node full hai aur abhi depthLimit nahi hai -> children add karo
    if (hasLeft) {
      queue.push({
        id: node.leftReferral,
        depth: depth + 1,
        side, // root ke respect me side same rahega
      });
    }
    if (hasRight) {
      queue.push({
        id: node.rightReferral,
        depth: depth + 1,
        side,
      });
    }
  }

  // Final pairs: left/right effective nodes ka min
  return Math.min(effectiveLeft, effectiveRight);
}

/**
 * ✅ NEW VERSION
 * DFS traversal sirf tree walk ke liye use ho raha hai (saare nodes visit karne ke liye),
 * lekin har node ka pairCount naya rule use karke niklega:
 *
 *   - pairCount(user) = pairs computed by computePairsUsingFullLevels(user)
 *
 * Iske baad:
 *   - difference se nayi pairs niklenge
 *   - unpe payment (100/pair max 5 per day)
 *   - rank update
 */
async function recalcPairsDFS(nodeId, session, visited = new Set()) {
  if (!nodeId) return 0;

  const key = String(nodeId);
  if (visited.has(key)) return 0;
  visited.add(key);

  const node = await User.findById(nodeId)
    .select("_id leftReferral rightReferral pairCount")
    .session(session);

  if (!node) return 0;

  // 👉 naya pairCount nikalna according to "full levels only" logic
  const totalPairs = await computePairsUsingFullLevels(node._id, session);

  const prevPairCount = node.pairCount || 0;
  const newPairsToPay = Math.max(0, totalPairs - prevPairCount); // ✅ sirf naye pairs

  // pairCount hamesha update hoga
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

  // DFS se children ko bhi process karo (taaki unka pairCount / rank / pay bhi update ho)
  if (node.leftReferral) {
    await recalcPairsDFS(node.leftReferral, session, visited);
  }
  if (node.rightReferral) {
    await recalcPairsDFS(node.rightReferral, session, visited);
  }

  return totalPairs;
}

module.exports = {
  upsertUserRankByPairCount,
  findRootId,
  recalcPairsDFS,
};
