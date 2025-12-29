const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const { placeUserBinary } = require("../services/binary.service");
const UserRank = require("../models/UserRank");
const { getRankByPairs } = require("../utils/rank.utils");
const jwt = require("jsonwebtoken");

const router = express.Router();



async function upsertUserRankByPairCount(userId, pairCount, session) {
  const rank = getRankByPairs(pairCount || 0);

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
        pairCountAtUpdate: pairCount || 0,
      },
      $currentDate: { updatedAt: true }, // ✅ force update timestamp
    },
    { upsert: true, session, setDefaultsOnInsert: true }
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

    // Create wallet
    // await Wallet.create([{ user: created._id, balance: 0 }], { session });
    // await Wallet.create([{ user: created._id, balance: 0 }], { session });


  
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
      // await upsertUserRank(rootId, session);
    }

    // await upsertUserRank(created._id, session);

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

router.get("/list", async (req, res) => {
  try {
    const users = await User.find({ role: "User" })
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
    if (!user)
      return res.status(404).json({ ok: false, error: "User not found" });

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

router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    // identifier = email OR phone OR username

    if (!identifier || !password) {
      return res.status(400).json({
        ok: false,
        error: "identifier and password are required",
      });
    }

    // normalize identifier
    const id = identifier.trim();

    // find by email OR phone OR username
    const user = await User.findOne({
      $or: [
        { email: id.toLowerCase() }, // email
        { phone: id }, // phone
        { username: id }, // username
      ],
    });

    if (!user) {
      return res.status(401).json({
        ok: false,
        error: "Invalid credentials",
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({
        ok: false,
        error: "Invalid credentials",
      });
    }

    // JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    // optional data
    // const wallet = await Wallet.findOne({ user: user._id }).select(
    //   "balance updatedAt"
    // );
    // const wallet = await Wallet.findOne({ user: user._id }).select("balance updatedAt");

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
      // wallet: wallet || { balance: 0 },
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
      .populate("referredBy", "name username email") // optional
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

module.exports = router;
