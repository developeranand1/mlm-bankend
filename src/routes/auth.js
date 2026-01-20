const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { placeUserBinary } = require("../services/binary.service");
const UserRank = require("../models/UserRank");
const { getRankByPairs } = require("../utils/rank.utils");
const jwt = require("jsonwebtoken");
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

    // Add to UserRank.pairAmount
    await UserRank.updateOne(
      { user: userId },
      { $inc: { pairAmount: amount } },
      { session }
    );

    // (Optional) If you also want to credit wallet, uncomment:
    // await Wallet.updateOne(
    //   { user: userId },
    //   { $inc: { balance: amount } },
    //   { upsert: true, session }
    // );
  }

  return { payablePairs, skippedPairs, maxLimitReached };
}


// async function upsertUserRankByPairCount(userId, pairCount, session) {
//   const rank = getRankByPairs(pairCount || 0);

//   if (!rank) {
//     await UserRank.deleteOne({ user: userId }).session(session);
//     return null;
//   }

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
//         bonusClaimed: false,
//         bonusClaimedAt: null,
//         bonusClaimedAmount: 0,
//       },
//       $currentDate: { updatedAt: true },
//     },
//     { upsert: true, session, setDefaultsOnInsert: true }
//   );

//   return rank;
// }

async function upsertUserRankByPairCount(userId, pairCount, session) {
  const safePairs = pairCount || 0;

  // 🛑 Yahin main condition:
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
 * Count pairs for ONE user using "full levels only" rule.
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

// pairs.helper.js (ya jahan bhi tumhara function hai)
async function computePairsUsingFullLevels(rootId, session) {
  const root = await User.findById(rootId)
    .select("leftReferral rightReferral status")
    .session(session);

  // Root khud hi Approved nahi -> is user ke liye koi pair hi nahi
  if (!root || root.status !== "Approved") return 0;

  const queue = [];

  let depthLimit = Infinity;
  let effectiveLeft = 0;
  let effectiveRight = 0;

  // BFS start: left/right child agar Approved hai tabhi consider karo
  if (root.leftReferral) {
    queue.push({ id: root.leftReferral, depth: 1, side: "left" });
  }
  if (root.rightReferral) {
    queue.push({ id: root.rightReferral, depth: 1, side: "right" });
  }

  while (queue.length > 0) {
    const { id, depth, side } = queue.shift();

    if (depth > depthLimit) continue;

    const node = await User.findById(id)
      .select("leftReferral rightReferral status")
      .session(session);

    // Node missing ya Approved nahi → ye level incomplete maana jayega
    if (!node || node.status !== "Approved") {
      if (depthLimit === Infinity) depthLimit = depth;  // yahi first incomplete level
      continue;
    }

    // Sirf Approved node hi count hoga
    if (side === "left") effectiveLeft++;
    else effectiveRight++;

    if (depth === depthLimit) continue;

    let hasLeft = false;
    let hasRight = false;

    // LEFT child sirf tab valid hai jab Approved ho
    if (node.leftReferral) {
      const leftChild = await User.findById(node.leftReferral)
        .select("status")
        .session(session);

      if (leftChild && leftChild.status === "Approved") {
        hasLeft = true;
        queue.push({
          id: leftChild._id,
          depth: depth + 1,
          side,
        });
      }
    }

    // RIGHT child sirf tab valid hai jab Approved ho
    if (node.rightReferral) {
      const rightChild = await User.findById(node.rightReferral)
        .select("status")
        .session(session);

      if (rightChild && rightChild.status === "Approved") {
        hasRight = true;
        queue.push({
          id: rightChild._id,
          depth: depth + 1,
          side,
        });
      }
    }

    // Agar kisi bhi side ka Approved child missing hai → depth yahin lock
    if (!hasLeft || !hasRight) {
      if (depthLimit === Infinity) {
        depthLimit = depth;
      }
    }
  }

  // Final pairs: dono side ke Approved nodes ka min
  return Math.min(effectiveLeft, effectiveRight);
}


// async function computePairsUsingFullLevels(rootId, session) {
//   const root = await User.findById(rootId)
//     .select("leftReferral rightReferral")
//     .session(session);

//   if (!root) return 0;

//   const queue = [];

//   if (root.leftReferral) {
//     queue.push({
//       id: root.leftReferral,
//       depth: 1,
//       side: "left",
//     });
//   }

//   if (root.rightReferral) {
//     queue.push({
//       id: root.rightReferral,
//       depth: 1,
//       side: "right",
//     });
//   }

//   let depthLimit = Infinity; // jis depth pe pehli baar incomplete node mile
//   let effectiveLeft = 0;
//   let effectiveRight = 0;

//   while (queue.length > 0) {
//     const { id, depth, side } = queue.shift();

//     // agar depthLimit set ho chuka hai, uske niche wale nodes ignore honge
//     if (depth > depthLimit) continue;

//     // is node ko side ke count me add karo
//     if (side === "left") effectiveLeft++;
//     else effectiveRight++;

//     // agar ye hi limiting depth hai, children ko explore mat karo
//     if (depth === depthLimit) continue;

//     const node = await User.findById(id)
//       .select("leftReferral rightReferral")
//       .session(session);

//     if (!node) continue;

//     const hasLeft = !!node.leftReferral;
//     const hasRight = !!node.rightReferral;

//     // agar node ke dono child nahi hai -> ye level se aage count nahi karna
//     if (!hasLeft || !hasRight) {
//       if (depthLimit === Infinity) {
//         depthLimit = depth; // yahi last depth hai jahan tak count allowed hai
//       }
//       // is node ke children ko queue me mat daalo
//       continue;
//     }

//     // node full hai aur abhi depthLimit nahi hai -> children add karo
//     if (hasLeft) {
//       queue.push({
//         id: node.leftReferral,
//         depth: depth + 1,
//         side, // root ke respect me side same rahega
//       });
//     }
//     if (hasRight) {
//       queue.push({
//         id: node.rightReferral,
//         depth: depth + 1,
//         side,
//       });
//     }
//   }

//   // Final pairs: left/right effective nodes ka min
//   return Math.min(effectiveLeft, effectiveRight);
// }



// 🔁 Recalculate pairs and pay 100 per pair (max 5 per day)
async function recalcPairsDFS(nodeId, session, memo = new Map()) {
  if (!nodeId) return 0;

  const key = String(nodeId);
  if (memo.has(key)) return memo.get(key);

  const node = await User.findById(nodeId)
    .select("_id leftReferral rightReferral pairCount")
    .session(session);

  if (!node) return 0;

  // ❗ NEW: use level-based rule instead of recursive sum
  const totalPairs = await computePairsUsingFullLevels(node._id, session);

  const prevPairCount = node.pairCount || 0;
  const newPairsToPay = Math.max(0, totalPairs - prevPairCount); // ✅ only newly formed pairs

  // Always update pairCount (pairs always counted)
  await User.updateOne(
    { _id: node._id },
    { $set: { pairCount: totalPairs } },
    { session }
  );

  // Ensure rank doc exists / updated
  await upsertUserRankByPairCount(node._id, totalPairs, session);

  // Pay 100 per pair for newly formed pairs (max 5 per day)
  if (newPairsToPay > 0) {
    await payPairsForUser(node._id, newPairsToPay, session);
  }

  memo.set(key, totalPairs);

  // DFS continue: ensure children also get recalculated with same rule
  if (node.leftReferral) {
    await recalcPairsDFS(node.leftReferral, session, memo);
  }
  if (node.rightReferral) {
    await recalcPairsDFS(node.rightReferral, session, memo);
  }

  return totalPairs;
}


async function propagateDownline(parentId, childId, session) {
  // 1) direct parent
  await User.updateOne(
    { _id: parentId },
    { $addToSet: { downline: childId } },
    { session }
  );

  // 2) saare uplines (referredBy chain)
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


// 🚀 Register route (unchanged logic, just uses recalcPairsDFS)
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
        side: side || "L",
        session,
      });

       parentIdForDownline = placement?.parentId || sponsor._id;

      // ✅ parent + saare uplines ke downline me is new user ko push karo
      await propagateDownline(parentIdForDownline, created._id, session);
    }

    // After placement: recalc from root (this will also handle pair payout)
    const rootId = await findRootId(created._id, session);
    if (rootId) {
      await recalcPairsDFS(rootId, session);
    }

     

    // Ensure this user has a rank doc as well
    await upsertUserRankByPairCount(created._id, created.pairCount || 0, session);

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
      rootUpdated: !!rootId,
    });
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ ok: false, error: e.message });
  }
});



router.patch("/user/status/:userId", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId } = req.params;   // ✅ ab yaha userId milega
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



router.get("/list", async (req, res) => {
  try {
    const users = await User.find({ role: "User" })
      .select("-password")
       .populate("referredBy", "name username email") 
      .populate("leftReferral", "name username")
      .populate("rightReferral", "name username")
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
    if (!user)
      return res.status(404).json({ ok: false, error: "User not found" });

    const rank = await UserRank.findOne({ user: user._id }).select(
      "position rankName requiredPairsPerSide bonusCash reward pairCountAtUpdate updatedAt pairAmount"
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

router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        ok: false,
        error: "identifier and password are required",
      });
    }

    const id = identifier.trim();

    const user = await User.findOne({
      $or: [
        { email: id.toLowerCase() },
        { phone: id },
        { username: id },
      ],
    });


    if (!user) {
      return res.status(401).json({
        ok: false,
        error: "Invalid credentials",
      });
    }

    if (user.role !== "User") {
      return res.status(403).json({
        ok: false,
        error: "Access denied. Only users can login here.",
      });
    }

    // ✅ isActive check
    if (user.isActive !== true) {
      return res.status(403).json({
        ok: false,
        error: "Your account is inactive. Please contact support.",
      });
    }

     if (user.status !== 'Approved') {
      return res.status(403).json({
        ok: false,
        error: "Your account is not approved. Please contact support.",
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({
        ok: false,
        error: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const rank = await UserRank.findOne({ user: user._id }).select(
      "position rankName requiredPairsPerSide bonusCash reward pairCountAtUpdate updatedAt"
    );

    return res.status(200).json({
      ok: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        referralCode: user.referralCode,
        pairCount: user.pairCount || 0,
      },
      rank: rank || null,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid user id",
      });
    }

    const user = await User.findById(id)
      .select("-password") // ❌ password hide
      .populate("referredBy", "name username email") 
      .populate("leftReferral", "name username")
      .populate("rightReferral", "name username");

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "User not found",
      });
    }

    return res.json({
      ok: true,
      user,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});


router.patch("/users/:id/status",async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body; // true/false

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: !!isActive },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ message: "Status updated", user });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


router.put("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ ok: false, error: "Invalid userId" });
    }

    // at least one field
    if (!name && !email && !phone) {
      return res.status(400).json({
        ok: false,
        error: "Provide at least one field: name, email, phone",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // EMAIL uniqueness check (ignore same user)
    if (email && email !== user.email) {
      const emailExists = await User.findOne({
        email: email.trim().toLowerCase(),
        _id: { $ne: userId },
      });

      if (emailExists) {
        return res
          .status(409)
          .json({ ok: false, error: "Email already exists" });
      }
    }

    // PHONE uniqueness check (optional but recommended)
    if (phone && phone !== user.phone) {
      const phoneExists = await User.findOne({
        phone: phone.trim(),
        _id: { $ne: userId },
      });

      if (phoneExists) {
        return res
          .status(409)
          .json({ ok: false, error: "Phone already exists" });
      }
    }

    // Update only allowed fields
    if (name) user.name = name.trim();
    if (email) user.email = email.trim().toLowerCase();
    if (phone) user.phone = phone.trim();

    await user.save();

    // return safe fields
    return res.json({
      ok: true,
      message: "User updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        status: user.status,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "Server error",
    });
  }
});

router.get("/filter-users", async (req, res) => {
  try {
    let {
      status,
      isActive,
      referredBy,
      fromDate,
      toDate,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;

    // ---------- BUILD FILTER ----------
    const filter = {};

    // force role = "User"
    filter.role = "User";

    if (status) {
      filter.status = status;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    if (referredBy) {
      filter.referredBy = referredBy;
    }

    // Date filter
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Search
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { username: regex },
      ];
    }

    // ---------- AGGREGATE STATS WITH FILTER ----------
    const [statsResult] = await User.aggregate([
      { $match: filter },
      {
        $facet: {
          countsByStatus: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ],
          countsByActive: [
            { $group: { _id: "$isActive", count: { $sum: 1 } } },
          ],
          referralStats: [
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                withReferredBy: {
                  $sum: { $cond: [{ $ifNull: ["$referredBy", false] }, 1, 0] },
                },
                withLeftReferral: {
                  $sum: { $cond: [{ $ifNull: ["$leftReferral", false] }, 1, 0] },
                },
                withRightReferral: {
                  $sum: { $cond: [{ $ifNull: ["$rightReferral", false] }, 1, 0] },
                },
                withDownline: {
                  $sum: {
                    $cond: [
                      { $gt: [{ $size: { $ifNull: ["$downline", []] } }, 0] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          pairStats: [
            {
              $group: {
                _id: null,
                totalLeftCount: { $sum: "$leftCount" },
                totalRightCount: { $sum: "$rightCount" },
                totalPairPaid: { $sum: "$pairPaid" },
                totalPairCount: { $sum: "$pairCount" },
                totalDailyPairPaid: { $sum: "$dailyPairPaid" },
              },
            },
          ],
        },
      },
    ]);

    // ---------- FORMAT STATS ----------
    const countsByStatus = {};
    (statsResult.countsByStatus || []).forEach((item) => {
      countsByStatus[item._id] = item.count;
    });

    const countsByActive = {};
    (statsResult.countsByActive || []).forEach((item) => {
      countsByActive[item._id ? "active" : "inactive"] = item.count;
    });

    const referralStats = statsResult.referralStats?.[0] || {
      totalUsers: 0,
      withReferredBy: 0,
      withLeftReferral: 0,
      withRightReferral: 0,
      withDownline: 0,
    };

    const pairStats = statsResult.pairStats?.[0] || {
      totalLeftCount: 0,
      totalRightCount: 0,
      totalPairPaid: 0,
      totalPairCount: 0,
      totalDailyPairPaid: 0,
    };

    const totalFilteredUsers = referralStats.totalUsers || 0;

    // ---------- PAGINATED USER LIST ----------
    const users = await User.find(filter)
      .populate("referredBy", "name email username")
      .populate("leftReferral", "name email username")
      .populate("rightReferral", "name email username")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      filterUsed: filter,
      pagination: {
        page,
        limit,
        totalFiltered: totalFilteredUsers,
        totalPages: Math.ceil(totalFilteredUsers / limit) || 1,
      },
      stats: {
        totalUsers: totalFilteredUsers,
        active: countsByActive.active || 0,
        inactive: countsByActive.inactive || 0,
        status: {
          Pending: countsByStatus.Pending || 0,
          Approved: countsByStatus.Approved || 0,
          Reject: countsByStatus.Reject || 0,
        },
        referrals: {
          withReferredBy: referralStats.withReferredBy || 0,
          withLeftReferral: referralStats.withLeftReferral || 0,
          withRightReferral: referralStats.withRightReferral || 0,
          withDownline: referralStats.withDownline || 0,
        },
        pairs: {
          totalLeftCount: pairStats.totalLeftCount || 0,
          totalRightCount: pairStats.totalRightCount || 0,
          totalPairPaid: pairStats.totalPairPaid || 0,
          totalPairCount: pairStats.totalPairCount || 0,
          totalDailyPairPaid: pairStats.totalDailyPairPaid || 0,
        },
      },
      data: users,
    });
  } catch (err) {
    console.error("Error in GET /api/users:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});





module.exports = router;
