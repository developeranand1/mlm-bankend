const Kyc = require("../models/Kyc");
const mongoose = require("mongoose");

// GET all KYC with user data
exports.getKycList = async (req, res) => {
  try {
    const kycs = await Kyc.find()
      .populate({
        path: "userId",
        select: "name email mobile role",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "KYC list fetched successfully",
      count: kycs.length,
      kycs,
    });
  } catch (error) {
    console.error("Get KYC List Error:", error);
    return res.status(500).json({
      message: "Failed to fetch KYC list",
      error: error.message,
    });
  }
};

exports.getKycById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "kycId parameter is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid kycId" });
    }

    const kyc = await Kyc.findById(id).populate({
      path: "userId",
      select: "name email mobile role",
    });

    if (!kyc) {
      return res.status(404).json({ message: "KYC not found" });
    }

    return res.status(200).json({ message: "KYC fetched successfully", kyc });
  } catch (error) {
    console.error("Get KYC By ID Error:", error);
    return res.status(500).json({
      message: "Failed to fetch KYC",
      error: error.message,
    });
  }
};

exports.updateKycStatus = async (req, res) => {
  try {
    const { kycId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(kycId)) {
      return res.status(400).json({ message: "Invalid kycId" });
    }

    const kyc = await Kyc.findByIdAndUpdate(
      kycId,
      { status },
      { new: true }
    );

    if (!kyc) {
      return res.status(404).json({ message: "KYC not found" });
    }

    res.status(200).json({
      message: "Status updated",
      kyc
    });
  } catch (e) {
    res.status(500).json({
      message: "Failed to update status",
      error: e.message
    });
  }
};

exports.getKycByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const kyc = await Kyc.findOne({ userId })
      .populate("userId", "name email phone role username"); // optional

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC details not found for this user",
      });
    }

    res.status(200).json({
      success: true,
      data: kyc,
    });
  } catch (error) {
    console.error("Get KYC Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching KYC details",
    });
  }
};
