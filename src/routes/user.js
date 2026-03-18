const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const UserRank = require("../models/UserRank");
const { placeUserBinary } = require("../services/binary.service");
const { getRankByPairs } = require("../utils/rank.utils");
const { applyDailyPairLimit } = require("../utils/pairLimit");

const router = express.Router();

const PAIR_INCOME_PER_PAIR = 100;


async function payPairsForUser(userId, newPairsToPay, session) {
  if (!newPairsToPay || newPairsToPay <= 0) {
    return { payablePairs: 0, skippedPairs: 0, maxLimitReached: false };
  }

  const { payablePairs, skippedPairs, maxLimitReached } =
    await applyDailyPairLimit(userId, newPairsToPay, session);

  if (payablePairs > 0) {
    const amount = payablePairs * PAIR_INCOME_PER_PAIR;

 
    await UserRank.updateOne(
      { user: userId },
      { $inc: { pairAmount: amount } },
      { session }
    );

  
  }

  return { payablePairs, skippedPairs, maxLimitReached };
}


async function upsertUserRankByPairCount(userId, pairCount, session) {
  const safePairs = pairCount || 0;

  // Check user status – rank only for Approved users
  const user = await User.findById(userId).select("status").session(session);
  if (!user || user.status !== "Approved") {
    await UserRank.deleteOne({ user: userId }).session(session);
    return null;
  }

  // Jab tak koi pair nahi (0 ya negative), UserRank mat rakho
  if (safePairs <= 0) {
    await UserRank.deleteOne({ user: userId }).session(session);
    return null;
  }

  const rank = getRankByPairs(safePairs);

  // Agar rankConfig hi nahi mila
  if (!rank) {
    await UserRank.deleteOne({ user: userId }).session(session);
    return null;
  }

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
        bonusClaimed: false,
        bonusClaimedAt: null,
        bonusClaimedAmount: 0,
      },
      $currentDate: { updatedAt: true },
    },
    { upsert: true, session, setDefaultsOnInsert: true }
  );

  return rank;
}



/**
 * Find the top-most root in the referredBy chain.
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
 * NEW RULE:
 * Count all "Approved" nodes on left side and right side of the given root,
 * then pairs = min(leftApprovedCount, rightApprovedCount).
 */
async function computePairsByApprovedNodes(rootId, session) {
  const root = await User.findById(rootId)
    .select("leftReferral rightReferral status")
    .session(session);

  if (!root) return 0; // root Approved hona zaroori nahi, sirf downline ke Approved count honge

  let leftApproved = 0;
  let rightApproved = 0;

  const queue = [];

  // Start BFS with left subtree
  if (root.leftReferral) {
    queue.push({ id: root.leftReferral, side: "left" });
  }

  // Start BFS with right subtree
  if (root.rightReferral) {
    queue.push({ id: root.rightReferral, side: "right" });
  }

  while (queue.length > 0) {
    const { id, side } = queue.shift();

    const node = await User.findById(id)
      .select("leftReferral rightReferral status")
      .session(session);

    if (!node) continue;

    // Count only Approved users
    if (node.status === "Approved") {
      if (side === "left") leftApproved++;
      else rightApproved++;
    }

    // Always check children (regardless of Approved or not)
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
 * Recalculate pairs for each node (DFS) from a root.
 * – Uses computePairsByApprovedNodes for pairCount.
 * – Updates User.pairCount.
 * – Upserts UserRank (only for Approved users).
 * – Pays income for newly formed pairs (daily limit handled inside).
 */
async function recalcPairsDFS(nodeId, session, memo = new Map()) {
  if (!nodeId) return 0;

  const key = String(nodeId);
  if (memo.has(key)) return memo.get(key);

  const node = await User.findById(nodeId)
    .select("_id leftReferral rightReferral pairCount")
    .session(session);

  if (!node) return 0;

  // Use approved-nodes-based rule
  const totalPairs = await computePairsByApprovedNodes(node._id, session);
const prevPairCount = node.pairCount || 0;
const newPairsToPay = Math.max(0, totalPairs - prevPairCount);

// 1) pairCount update
await User.updateOne(
  { _id: node._id },
  { $set: { pairCount: totalPairs } },
  { session }
);

// 2) yaha rank function
await upsertUserRankByPairCount(node._id, totalPairs, session);

// 3) yaha payment
if (newPairsToPay > 0) {
  await payPairsForUser(node._id, newPairsToPay, session);
}


  memo.set(key, totalPairs);

  // DFS: recalc children as well
  if (node.leftReferral) {
    await recalcPairsDFS(node.leftReferral, session, memo);
  }
  if (node.rightReferral) {
    await recalcPairsDFS(node.rightReferral, session, memo);
  }

  return totalPairs;
}

/**
 * Propagate downline user to parent and all uplines.
 */
async function propagateDownline(parentId, childId, session) {
  // Direct parent
  await User.updateOne(
    { _id: parentId },
    { $addToSet: { downline: childId } },
    { session }
  );

  // All uplines (referredBy chain)
  let currentNode = await User.findById(parentId).session(session);
  let uplineId = currentNode ? currentNode.referredBy : null;

  while (uplineId) {
    const upline = await User.findById(uplineId).session(session);
    if (!upline) break;

    await User.updateOne(
      { _id: upline._id },
      { $addToSet: { downline: childId } },
      { session }
    );

    uplineId = upline.referredBy;
  }
}

/**
 * 🚀 Register route
 */

router.post("/register", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, email, phone, password, referralCode, side } = req.body;

    const normalizedSide = String(side || "L").trim().toUpperCase();

    if (!name || !email || !phone || !password) {
      throw new Error("name, email, phone, password are required");
    }

    if (!["L", "R"].includes(normalizedSide)) {
      throw new Error("side must be either L or R");
    }

    let sponsor = null;
    if (referralCode) {
      sponsor = await User.findOne({ referralCode }).session(session);
      if (!sponsor) throw new Error("Invalid referral code");
    }

    const existingUser = await User.findOne({
      $or: [{ email }],
    }).session(session);

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const hashed = await bcrypt.hash(password, 10);

    const createdArr = await User.create(
      [
        {
          name,
          email,
          phone,
          password: hashed,
          referredBy: sponsor ? sponsor._id : null,
          referralCode: `RC${Math.random()
            .toString(36)
            .slice(2, 8)
            .toUpperCase()}`,
        },
      ],
      { session }
    );

    const created = createdArr[0];
    let placement = null;

    if (sponsor) {
      placement = await placeUserBinary({
        newUserId: created._id,
        sponsorId: sponsor._id,
        side: normalizedSide,
        session,
      });

      const parentIdForDownline = placement?.parentId || sponsor._id;
      await propagateDownline(parentIdForDownline, created._id, session);
    }

    await session.commitTransaction();
    session.endSession();

    const token = jwt.sign(
      { user: { id: created._id } },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({
      ok: true,
      message: "User registered successfully",
      token,
      user: {
        id: created._id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        referralCode: created.referralCode,
        referredBy: created.referredBy,
      },
      userId: created._id,
      referralCode: created.referralCode,
      placement,
    });
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ ok: false, error: e.message });
  }
});


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
//           // status: "Pending", // if not handled by default schema you can uncomment this
//           referralCode: `RC${Math.random()
//             .toString(36)
//             .slice(2, 8)
//             .toUpperCase()}`,
//         },
//       ],
//       { session }
//     );
//     const created = createdArr[0];

//     let placement = null;

//     if (sponsor) {
//       placement = await placeUserBinary({
//         newUserId: created._id,
//         sponsorId: sponsor._id,
//         side: side || "L",
//         session,
//       });

//       const parentIdForDownline = placement?.parentId || sponsor._id;

//       // parent + saare uplines ke downline me is new user ko push karo
//       await propagateDownline(parentIdForDownline, created._id, session);
//     }

//     await session.commitTransaction();
//     session.endSession();

//     const token = jwt.sign(
//       { user: { id: created._id } },
//       process.env.JWT_SECRET,
//       { expiresIn: "1h" }
//     );

//     return res.json({
//       ok: true,
//       message: "User registered successfully",
//       token,
//       user: {
//         id: created._id,
//         name: created.name,
//         email: created.email,
//         phone: created.phone,
//         referralCode: created.referralCode,
//         referredBy: created.referredBy,
//       },
//       userId: created._id,
//       referralCode: created.referralCode,
//       placement,
//     });
//   } catch (e) {
//     await session.abortTransaction();
//     session.endSession();
//     return res.status(400).json({ ok: false, error: e.message });
//   }
// });


router.patch("/user/status/:userId", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!["Approved", "Reject", "Pending"].includes(status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const oldStatus = user.status;
    user.status = status;
    await user.save({ session });

    // Jab bhi status change ho (Pending -> Approved, Approved -> Reject, etc.)
    if (oldStatus !== status) {
      const rootId = await findRootId(user._id, session);
      if (rootId) {
        await recalcPairsDFS(rootId, session);
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: `User status updated to ${status}`,
      data: user,
    });
  } catch (error) {
    console.error(error);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});



router.post("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;

    // check email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // update password
    user.password = hashedPassword;

    await user.save();

    res.status(200).json({
      message: "Password reset successfully"
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});
module.exports = router;
