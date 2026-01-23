const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { RANKS, getCurrentRankByPairs, getNextRank, calcNeed } = require("../utils/needRank");

router.get("/users/:id/rank-progress", async (req, res) => {
  try {
    const { id } = req.params;
    const next = Math.min(Math.max(parseInt(req.query.next || "5", 10), 1), 15);

    const user = await User.findById(id).select(
      "username name email phone leftCount rightCount pairCount status isActive role"
    ).lean();

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const currentRank = getCurrentRankByPairs(user.pairCount || 0);
    const nextRank = getNextRank(currentRank);

    const nextRanksList = [];
    if (currentRank) {
      for (let i = currentRank.position + 1; i <= Math.min(currentRank.position + next, RANKS.length); i++) {
        const r = RANKS.find(x => x.position === i);
        if (!r) continue;
        const need = calcNeed(user.leftCount || 0, user.rightCount || 0, r.requiredPairsPerSide);
        nextRanksList.push({
          position: r.position,
          rankName: r.rankName,
          requiredPairsPerSide: r.requiredPairsPerSide,
          reward: r.reward,
          bonusCash: r.bonusCash,
          needLeft: need.needLeft,
          needRight: need.needRight,
          weakerSide: need.weakerSide,
        });
      }
    } else {
      // no current rank => next ranks from position 1
      for (let i = 1; i <= Math.min(next, RANKS.length); i++) {
        const r = RANKS[i - 1];
        const need = calcNeed(user.leftCount || 0, user.rightCount || 0, r.requiredPairsPerSide);
        nextRanksList.push({
          position: r.position,
          rankName: r.rankName,
          requiredPairsPerSide: r.requiredPairsPerSide,
          reward: r.reward,
          bonusCash: r.bonusCash,
          needLeft: need.needLeft,
          needRight: need.needRight,
          weakerSide: need.weakerSide,
        });
      }
    }

    const nextNeed = nextRank
      ? calcNeed(user.leftCount || 0, user.rightCount || 0, nextRank.requiredPairsPerSide)
      : null;

    return res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
      },
      counts: {
        leftCount: user.leftCount || 0,
        rightCount: user.rightCount || 0,
        pairCount: user.pairCount || 0,
      },
      currentRank: currentRank
        ? {
            position: currentRank.position,
            rankName: currentRank.rankName,
            requiredPairsPerSide: currentRank.requiredPairsPerSide,
            reward: currentRank.reward,
            bonusCash: currentRank.bonusCash,
          }
        : null,
      nextRank: nextRank
        ? {
            position: nextRank.position,
            rankName: nextRank.rankName,
            requiredPairsPerSide: nextRank.requiredPairsPerSide,
            reward: nextRank.reward,
            bonusCash: nextRank.bonusCash,
            needLeft: nextNeed.needLeft,
            needRight: nextNeed.needRight,
            weakerSide: nextNeed.weakerSide,
          }
        : null,
      nextRanks: nextRanksList, // ✅ next 5 levels detail
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/users/rank-progress/all", async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", next = 5 } = req.query;

    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const lm = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const nextN = Math.min(Math.max(parseInt(next, 10) || 5, 1), 15);

    const filter = { role: "User" }; // ✅ only Users (remove if you want admin too)

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { username: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select("username name email phone leftCount rightCount pairCount status isActive role createdAt")
      .sort({ createdAt: -1 })
      .skip((pg - 1) * lm)
      .limit(lm)
      .lean();

    const data = users.map((u) => {
      const currentRank = getCurrentRankByPairs(u.pairCount || 0);
      const nextRank = getNextRank(currentRank);

      const nextNeed = nextRank
        ? calcNeed(u.leftCount || 0, u.rightCount || 0, nextRank.requiredPairsPerSide)
        : null;

      // next 5 levels list
      const nextRanksList = [];
      const startPos = currentRank ? currentRank.position + 1 : 1;

      for (let pos = startPos; pos <= Math.min(startPos + nextN - 1, RANKS.length); pos++) {
        const r = RANKS.find(x => x.position === pos);
        if (!r) continue;
        const need = calcNeed(u.leftCount || 0, u.rightCount || 0, r.requiredPairsPerSide);

        nextRanksList.push({
          position: r.position,
          rankName: r.rankName,
          requiredPairsPerSide: r.requiredPairsPerSide,
          reward: r.reward,
          bonusCash: r.bonusCash,
          needLeft: need.needLeft,
          needRight: need.needRight,
          weakerSide: need.weakerSide,
        });
      }

      return {
        user: {
          id: u._id,
          username: u.username,
          name: u.name,
          email: u.email,
          phone: u.phone,
          status: u.status,
          isActive: u.isActive,
          role: u.role,
          createdAt: u.createdAt,
        },
        counts: {
          leftCount: u.leftCount || 0,
          rightCount: u.rightCount || 0,
          pairCount: u.pairCount || 0,
        },
        currentRank: currentRank
          ? { position: currentRank.position, rankName: currentRank.rankName, requiredPairsPerSide: currentRank.requiredPairsPerSide }
          : null,
        nextRank: nextRank
          ? {
              position: nextRank.position,
              rankName: nextRank.rankName,
              requiredPairsPerSide: nextRank.requiredPairsPerSide,
              needLeft: nextNeed.needLeft,
              needRight: nextNeed.needRight,
              weakerSide: nextNeed.weakerSide,
            }
          : null,
        nextRanks: nextRanksList, // ✅ 5 next levels
      };
    });

    return res.json({
      success: true,
      total,
      pagination: {
        page: pg,
        limit: lm,
        totalPages: Math.ceil(total / lm),
      },
      data,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
