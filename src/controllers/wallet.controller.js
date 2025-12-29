
const mongoose = require("mongoose");
const UserRank = require("../models/UserRank");
const Wallet = require("../models/Wallet");

// exports.claimRankBonus = async (req, res) => {
// const userId = req.user._id;

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     // 1️⃣ UserRank fetch
//     const rank = await UserRank.findOne({ user: userId }).session(session);

//     if (!rank) {
//       await session.abortTransaction();
//       return res.status(404).json({ ok: false, error: "UserRank not found" });
//     }

//     if (rank.bonusClaimed) {
//       await session.abortTransaction();
//       return res.status(400).json({ ok: false, error: "Bonus already claimed" });
//     }

//     const bonus = Number(rank.bonusCash || 0);
//     if (bonus <= 0) {
//       await session.abortTransaction();
//       return res.status(400).json({ ok: false, error: "No bonusCash available" });
//     }

//     // 2️⃣ Wallet create/update + add bonus
//     const wallet = await Wallet.findOneAndUpdate(
//       { user: userId },
//       { $inc: { balance: bonus } },
//       { upsert: true, new: true, session }
//     );

//     // 3️⃣ UserRank update → bonusCash ZERO
//     rank.bonusClaimed = true;
//     rank.bonusClaimedAt = new Date();
//     rank.bonusClaimedAmount = bonus;
//     rank.bonusCash = 0; // 🔥 YAHI MAIN POINT
//     await rank.save({ session });

//     await session.commitTransaction();

//     return res.json({
//       ok: true,
//       message: "Bonus successfully transferred to wallet",
//       transferredAmount: bonus,
//       walletBalance: wallet.balance,
//     });
//   } catch (err) {
//     await session.abortTransaction();
//     return res.status(500).json({ ok: false, error: err.message });
//   } finally {
//     session.endSession();
//   }
// };

exports.claimRankBonus = async (req, res) => {
  const userId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const rank = await UserRank.findOne({ user: userId }).session(session);

    if (!rank) {
      await session.abortTransaction();
      return res.status(404).json({ ok: false, error: "UserRank not found" });
    }

    // ✅ ONLY depend on bonusCash
    const bonus = Number(rank.bonusCash || 0);
    if (bonus <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ ok: false, error: "No bonusCash available" });
    }

    // ✅ Wallet add
    const wallet = await Wallet.findOneAndUpdate(
      { user: userId },                 // IMPORTANT: Wallet schema must have `user`
      { $inc: { balance: bonus } },
      { upsert: true, new: true, session, setDefaultsOnInsert: true }
    );

    // ✅ Mark claim history + zero bonusCash
    rank.bonusClaimed = true;           // optional (just for UI)
    rank.bonusClaimedAt = new Date();
    rank.bonusClaimedAmount = bonus;    // last claimed amount
    rank.bonusCash = 0;
    await rank.save({ session });

    await session.commitTransaction();

    return res.json({
      ok: true,
      message: "Bonus transferred to wallet",
      transferredAmount: bonus,
      walletBalance: wallet.balance,
    });
  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    session.endSession();
  }
};

exports.listAllWallets = async (req, res) => {
  try {
    const wallets = await Wallet.find({})
      .populate("user", "name email phone username")
      .sort({ createdAt: -1 });

    return res.json({
      ok: true,
      count: wallets.length,
      wallets: wallets.map(w => ({
        id: w._id,
        user: w.user,
        balance: w.balance,
        locked: w.locked,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
    });
  } catch (err) {
    console.error("listAllWallets error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};

exports.getWalletByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    // ✅ validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ ok: false, error: "Invalid userId" });
    }

    // 1️⃣ Wallet fetch
    const wallet = await Wallet.findOne({ user: userId })
      .populate("user", "name email phone username");

    // 2️⃣ Rank fetch
    const rank = await UserRank.findOne({ user: userId }).select(
      "position rankName requiredPairsPerSide bonusCash reward pairCountAtUpdate bonusClaimed bonusClaimedAmount updatedAt"
    );

    if (!wallet && !rank) {
      return res.status(404).json({
        ok: false,
        error: "No wallet or rank found for this user",
      });
    }

    return res.json({
      ok: true,
      userId,
      wallet: wallet
        ? {
            balance: wallet.balance,
            locked: wallet.locked,
            updatedAt: wallet.updatedAt,
          }
        : { balance: 0, locked: 0 },
      rank: rank || null,
    });
  } catch (err) {
    console.error("getWalletByUserId error:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
