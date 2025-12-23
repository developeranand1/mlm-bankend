const Kyc = require("../models/Kyc");

// GET all KYC with user data
exports.getKycList = async (req, res) => {
  try {
    const kycs = await Kyc.find()
      .populate({
        path: "userId",
        select: "name email mobile role", // only required user fields
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
