const mongoose = require("mongoose");
const PaymentOrder = require("../models/PaymentOrder");

// USER: apni payments
exports.myPayments = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "User not authenticated" });

    const list = await PaymentOrder.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ count: list.length, payments: list });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch my payments", error: err.message });
  }
};

// ADMIN: sab users ki payments
exports.allPayments = async (req, res) => {
  try {
    const list = await PaymentOrder.find({})
      .sort({ createdAt: -1 })
      .populate("userId", "name email userId") // optional fields
      .lean();

    return res.json({ count: list.length, payments: list });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch payments", error: err.message });
  }
};

// USERID params: /user/:userId
exports.paymentsByUserIdParam = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const list = await PaymentOrder.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ count: list.length, payments: list });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch user payments", error: err.message });
  }
};
