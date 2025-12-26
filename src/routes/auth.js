const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const { placeUserBinary } = require("../services/binary.service");
const UserRank = require("../models/UserRank");
const { getRankByPairs } = require("../utils/rank.utils");

const router = express.Router();


async function upsertUserRank(userId, session) {
  const user = await User.findById(userId).select("_id pairCount").session(session);
  if (!user) return null;

  const rank = getRankByPairs(user.pairCount || 0);
  if (!rank) {
    // no rank achieved yet -> optional: delete rank doc
    await UserRank.deleteOne({ user: user._id }).session(session);
    return null;
  }

  await UserRank.updateOne(
    { user: user._id },
    {
      $set: {
        position: rank.position,
        rankName: rank.rankName,
        requiredPairsPerSide: rank.requiredPairsPerSide,
        bonusCash: rank.bonusCash,
        reward: rank.reward,
        pairCountAtUpdate: user.pairCount || 0,
      },
    },
    { upsert: true, session }
  );

  return rank;
}

/**
 * Find root by following referredBy chain up to top
 */
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
 * Recalculate pairCount for entire subtree (post-order DFS)
 * pairCount = leftSubtreePairs + rightSubtreePairs + (hasBothChildren ? 1 : 0)
 *
 * IMPORTANT: schema uses leftReferral/rightReferral (not leftChild/rightChild)
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

  memo.set(key, totalPairs);
  return totalPairs;
}

router.post("/register", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, email, phone, password, referralCode, side } = req.body;

    if (!name || !email || !phone || !password) {
      throw new Error("name, email, phone, password are required");
    }

    // Sponsor
    let sponsor = null;
    if (referralCode) {
      sponsor = await User.findOne({ referralCode }).session(session);
      if (!sponsor) throw new Error("Invalid referral code");
    }

    // Create user
    const hashed = await bcrypt.hash(password, 10);

    const createdArr = await User.create(
      [
        {
          name,
          email,
          phone,
          password: hashed,
          referredBy: sponsor ? sponsor._id : null,
          referralCode: `RC${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        },
      ],
      { session }
    );
    const created = createdArr[0];

    // Create wallet
    await Wallet.create([{ user: created._id, balance: 0 }], { session });

    // Placement in binary tree (this should set sponsor.leftReferral/rightReferral etc.)
    let placement = null;
    if (sponsor) {
      placement = await placeUserBinary({
        newUserId: created._id,
        sponsorId: sponsor._id,
        side: side || "L",
        session,
      });
    }

    // ✅ After placement: recalc from root
    const rootId = await findRootId(created._id, session);
    if (rootId) {
      await recalcPairsDFS(rootId, session);
        await upsertUserRank(rootId, session);
    }

     await upsertUserRank(created._id, session);

    await session.commitTransaction();
    session.endSession();

    return res.json({
      ok: true,
      message: "User registered successfully",
      userId: created._id,
      referralCode: created.referralCode,
      placement,
      rootUpdated: !!rootId,
    });
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ ok: false, error: e.message });
  }
});

router.get("/list", async (req, res) => {
  try {
    const users = await User.find({})
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({
      ok: true,
      total: users.length,
      users,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/status/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("name pairCount");
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    const rank = await UserRank.findOne({ user: user._id }).select(
      "position rankName requiredPairsPerSide bonusCash reward pairCountAtUpdate updatedAt"
    );

    res.json({
      ok: true,
      user: { id: user._id, name: user.name, pairCount: user.pairCount },
      rank: rank || null,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


module.exports = router;


// router.post("/register", async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { name, email, phone, password, referralCode, side } = req.body;

//     if (!name || !email || !phone || !password) {
//       throw new Error("name, email, phone, password are required");
//     }

//     // Sponsor
//     let sponsor = null;
//     if (referralCode) {
//       sponsor = await User.findOne({ referralCode }).session(session);
//       if (!sponsor) throw new Error("Invalid referral code");
//     }

//     // Create user
//     const hashed = await bcrypt.hash(password, 10);

//     const createdArr = await User.create(
//       [
//         {
//           name,
//           email,
//           phone,
//           password: hashed,
//           referredBy: sponsor ? sponsor._id : null,
//           referralCode: `RC${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
//         },
//       ],
//       { session }
//     );
//     const created = createdArr[0];

//     // Create wallet
//     await Wallet.create([{ user: created._id, balance: 0 }], { session });

//     // Placement
//     let placement = null;
//     if (sponsor) {
//       placement = await placeUserBinary({
//         newUserId: created._id,
//         sponsorId: sponsor._id,
//         side: side || "L",
//         session,
//       });
//     }

//     await session.commitTransaction();
//     session.endSession();

//     res.json({
//       ok: true,
//       message: "User registered successfully",
//       userId: created._id,
//       referralCode: created.referralCode,
//       placement,
//     });
//   } catch (e) {
//     await session.abortTransaction();
//     session.endSession();
//     res.status(400).json({ ok: false, error: e.message });
//   }
// });

// });