const User = require("../models/User");
const UserRank = require("../models/UserRank");
const { getRankByPairs } = require("../utils/rank.utils"); 

async function upsertUserRankByPairCount(userId, pairCount, session) {
  const rank = getRankByPairs(pairCount || 0);

  // No rank → remove rank record
  if (!rank) {
    await UserRank.deleteOne({ user: userId }).session(session);
    return null;
  }

  // Existing rank record
  const existing = await UserRank.findOne({ user: userId }).session(session);

  const isNewRank =
    !existing || existing.position !== rank.position;

  // 🔥 If rank upgraded → credit bonus
  if (isNewRank) {
    // 1️⃣ Credit bonus cash
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
        bonusClaimedAmount: isNewRank ? rank.bonusCash : existing?.bonusClaimedAmount ?? 0,
      },
      $currentDate: { updatedAt: true },
    },
    { upsert: true, session, setDefaultsOnInsert: true }
  );

  return rank;
}


/** Find root by following referredBy chain up to top */
async function findRootId(startUserId, session) {
  let cur = await User.findById(startUserId).select("_id referredBy").session(session);
  if (!cur) return null;

  while (cur.referredBy) {
    const next = await User.findById(cur.referredBy).select("_id referredBy").session(session);
    if (!next) break;
    cur = next;
  }
  return cur ? cur._id : null;
}

/**
 * DFS to recalc pairCount:
 * pairCount = leftPairs + rightPairs + (hasBothChildren ? 1 : 0)
 * Also updates UserRank for every node touched.
 */
async function recalcPairsDFS(nodeId, session, memo = new Map()) {
  if (!nodeId) return 0;

  const key = String(nodeId);
  if (memo.has(key)) return memo.get(key);

  const node = await User.findById(nodeId)
    .select("_id leftReferral rightReferral")
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

  await User.updateOne(
    { _id: node._id },
    { $set: { pairCount: totalPairs } },
    { session }
  );

  await upsertUserRankByPairCount(node._id, totalPairs, session);

  memo.set(key, totalPairs);
  return totalPairs;
}

module.exports = {
  upsertUserRankByPairCount,
  findRootId,
  recalcPairsDFS,
};
