const UserRank = require("../models/UserRank");
const mongoose = require("mongoose");

exports.getAllUserRanks = async (req, res) => {
  try {
    // Optional sorting by rank position
    const ranks = await UserRank.find()
      .populate({
        path: "user",
        select: "name email phone username referralCode pairCount leftCount rightCount status isActive"
      })
      .sort({ position: 1 }) // lowest position first (optional)
      .lean();

    return res.status(200).json({
      success: true,
      total: ranks.length,
      data: ranks,
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

