const express = require("express");
const router = express.Router();

const WeeklyPayout = require("../models/WeeklyPayout");
const generateWeeklyPayoutList = require("../services/weeklyPayoutJob");
const upload = require("../middlewares/uploadProof");

router.post("/generate", async (req, res) => {
  try {
    await generateWeeklyPayoutList();

    return res.json({
      success: true,
      message: "Weekly payout list generated successfully",
    });
  } catch (err) {
    console.error("Error generating weekly payout list:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate weekly payout list",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const payouts = await WeeklyPayout.find({})
      .populate("user", "name email") // apne user model ke hisaab se
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await WeeklyPayout.countDocuments({});

    res.json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      data: payouts,
    });
  } catch (err) {
    console.error("Error fetching weekly payout list:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch weekly payout list",
    });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const payouts = await WeeklyPayout.find({ user: userId })
      .populate("user", "name email username") // optional
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: payouts.length,
      data: payouts,
    });
  } catch (err) {
    console.error("Error fetching payouts by user:", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminRemark } = req.body;

    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const updateData = { status };
    if (adminRemark) updateData.adminRemark = adminRemark;

    const updated = await WeeklyPayout.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).populate("user", "name email username");

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Payout not found",
      });
    }

    return res.json({
      success: true,
      message: "Payout status updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error updating payout status:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update payout status",
    });
  }
});

router.patch("/:id/payment", upload.single("proof"), async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentType, transactionId, adminRemark } = req.body;

    const payout = await WeeklyPayout.findById(id);
    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout not found",
      });
    }

    // sirf APPROVED payouts pe hi payment details add karne dena
    if (payout.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "Payment details can only be added when status is APPROVED",
      });
    }

    if (paymentType) payout.paymentType = paymentType;
    if (transactionId) payout.transactionId = transactionId;
    if (adminRemark) payout.adminRemark = adminRemark;

    if (req.file) {
      // cloudinary URL
      payout.proofFileUrl = req.file.path;
    }

    await payout.save();

    const populated = await payout.populate("user", "name email username");

    return res.json({
      success: true,
      message: "Payment details updated successfully",
      data: populated,
    });
  } catch (err) {
    console.error("Error updating payout payment details:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update payment details",
    });
  }
});

module.exports = router;
