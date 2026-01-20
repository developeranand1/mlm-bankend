// services/pair.service.js

const User = require("../models/User");
const UserRank = require("../models/UserRank");
const { getRankByPairs } = require("../utils/rank.utils");
const { applyDailyPairLimit } = require("../utils/pairLimit");

const PAIR_INCOME_PER_PAIR = 100; // 💰 100 per pair

// 💸 Naye pairs ke liye payment: 100 per pair, per date max 5 (applyDailyPairLimit se)
async function payPairsForUser(userId, newPairsToPay, session) {
  if (!newPairsToPay || newPairsToPay <= 0) {
    return { payablePairs: 0, skippedPairs: 0, maxLimitReached: false };
  }

  const { payablePairs, skippedPairs, maxLimitReached } =
    await applyDailyPairLimit(userId, newPairsToPay, session);

  if (payablePairs > 0) {
    const amount = payablePairs * PAIR_INCOME_PER_PAIR;

    // 👉 pairAmount me paisa add karo (upsert true, taaki doc na ho to bhi ban jaye)
    await UserRank.updateOne(
      { user: userId },
      { $inc: { pairAmount: amount } },
      { upsert: true, session }
    );
  }

  return { payablePairs, skippedPairs, maxLimitReached };
}

/**
 * Rank ko update karo, lekin UserRank document delete MAT karo
 * warna pairAmount bhi ud jata hai.
 */
async function upsertUserRankByPairCount(userId, pairCount, session) {
  const safePairs = pairCount || 0;

  const rank = getRankByPairs(safePairs);

  // Rank config hi nahi mila → rank fields null, lekin doc & pairAmount safe
  if (!rank) {
    await UserRank.updateOne(
      { user: userId },
      {
        $set: {
          position: null,
          rankName: null,
          requiredPairsPerSide: null,
          bonusCash: 0,
          reward: "",
          pairCountAtUpdate: safePairs,
          bonusClaimed: false,
          bonusClaimedAt: null,
          bonusClaimedAmount: 0,
        },
        $currentDate: { updatedAt: true },
      },
      { upsert: true, session }
    );
    return null;
  }

  // Existing rank record
  const existing = await UserRank.findOne({ user: userId }).session(session);
  const isNewRank = !existing || existing.position !== rank.position;

  // 🔥 If rank upgraded → credit bonus (one time)
  if (isNewRank && rank.bonusCash > 0) {
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
        pairCountAtUpdate: safePairs,

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
 * ✅ NEW RULE:
 * Count all nodes with status === "Approved" on left subtree and right subtree.
 *
 * Steps:
 *  - BFS from root's leftReferral / rightReferral.
 *  - Har node ke liye:
 *      - agar status === "Approved" → leftApproved/rightApproved++ (side ke hisaab se)
 *      - phir uske children queue me daal do (status chahe kuch bhi ho)
 *  - FINAL: pairs = min(leftApproved, rightApproved)
 */
async function computePairsByApprovedNodes(rootId, session) {
  const root = await User.findById(rootId)
    .select("leftReferral rightReferral status")
    .session(session);

  if (!root) return 0;

  let leftApproved = 0;
  let rightApproved = 0;

  const queue = [];

  // left side subtree
  if (root.leftReferral) {
    queue.push({ id: root.leftReferral, side: "left" });
  }

  // right side subtree
  if (root.rightReferral) {
    queue.push({ id: root.rightReferral, side: "right" });
  }

  while (queue.length > 0) {
    const { id, side } = queue.shift();

    const node = await User.findById(id)
      .select("leftReferral rightReferral status")
      .session(session);

    if (!node) continue;

    // sirf Approved ko count karo
    if (node.status === "Approved") {
      if (side === "left") leftApproved++;
      else rightApproved++;
    }

    // status kuch bhi ho, children explore karte rahenge
    if (node.leftReferral) {
      queue.push({ id: node.leftReferral, side });
    }
    if (node.rightReferral) {
      queue.push({ id: node.rightReferral, side });
    }
  }

  return Math.min(leftApproved, rightApproved);
}

/**
 * DFS:
 *  - har node ke liye 👉 APPROVED-NODES RULE se totalPairs nikalo
 *  - diff se nayi pairs (= newPairsToPay)
 *  - User.pairCount update
 *  - Rank update
 *  - payPairsForUser() → pairAmount += 100 * payablePairs
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

  // 👇 Yahi main change: ab approved-nodes rule use ho raha hai
  const totalPairs = await computePairsByApprovedNodes(node._id, session);

  const prevPairCount = node.pairCount || 0;
  const newPairsToPay = Math.max(0, totalPairs - prevPairCount);

  await User.updateOne(
    { _id: node._id },
    { $set: { pairCount: totalPairs } },
    { session }
  );

  await upsertUserRankByPairCount(node._id, totalPairs, session);

  if (newPairsToPay > 0) {
    await payPairsForUser(node._id, newPairsToPay, session);
  }

  if (node.leftReferral) {
    await recalcPairsDFS(node.leftReferral, session, visited);
  }
  if (node.rightReferral) {
    await recalcPairsDFS(node.rightReferral, session, visited);
  }

  return totalPairs;
}

module.exports = {
  payPairsForUser,
  upsertUserRankByPairCount,
  findRootId,
  recalcPairsDFS,
};
