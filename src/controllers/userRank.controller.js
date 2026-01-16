const User = require("../models/User");
const UserRank = require("../models/UserRank");
const mongoose = require("mongoose");

// exports.getAllUserRanks = async (req, res) => {
//   try {
//     // Optional sorting by rank position
//     const ranks = await UserRank.find()
//       .populate({
//         path: "user",
//         select: "name email phone username referralCode pairCount leftCount rightCount status isActive"
//       })
//       .sort({ position: 1 }) // lowest position first (optional)
//       .lean();

//     return res.status(200).json({
//       success: true,
//       total: ranks.length,
//       data: ranks,
//     });

//   } catch (err) {
//     return res.status(500).json({
//       success: false,
//       message: err.message || "Failed to fetch ranks",
//     });
//   }
// };

exports.getAllUserRanks = async (req, res) => {
  try {
    const ranks = await UserRank.find()
      .populate({
        path: "user",
        select: "name email phone username referralCode pairCount leftCount rightCount status isActive",
        match: { status: "Approved" } // ⬅️ only approved users
      })
      .sort({ position: 1 })
      .lean();

    // Filter out ranks where user did not match (status != Approved)
    const approvedRanks = ranks.filter(r => r.user !== null);

    return res.status(200).json({
      success: true,
      total: approvedRanks.length,
      data: approvedRanks,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch ranks",
    });
  }
};


exports.deleteUserRank = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rank ID",
      });
    }

    const deleted = await UserRank.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Rank not found or already deleted",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Rank deleted successfully",
      deletedId: id,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to delete rank",
    });
  }
};


exports.getUserRankByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. Check user exists and is Approved
    const user = await User.findOne({ _id: userId, status: "Approved" });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found or not approved",
      });
    }

    // 2. Get rank for this user
    // user field is unique in UserRank, so findOne is enough
    const rank = await UserRank.findOne({ user: userId })
      .populate("user", "name email phone username status")
      .sort({ position: 1 });

    if (!rank) {
      return res.json({
        success: true,
        total: 0,
        data: [],
        message: "No rank found for this user",
      });
    }

    // 3. Return as list-style response (array)
    return res.json({
      success: true,
      total: 1,
      data: [rank],
    });
  } catch (err) {
    console.error("Get UserRank By User Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};


