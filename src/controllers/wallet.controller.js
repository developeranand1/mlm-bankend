const PaymentOrder = require("../models/PaymentOrder");
const WalletTxn = require("../models/WalletTransaction");
const { razorpay } = require("../config/razorpay");

exports.createAddFundOrder = async (req, res) => {
  const userId = req.user._id;
  const amount = Number(req.body.amount);

  if (!amount || amount < 10) return res.status(400).json({ message: "Min amount 10" });

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt: `ADD_${userId}_${Date.now()}`,
  });

  // PaymentOrder
  await PaymentOrder.create({
    userId,
    razorpayOrderId: order.id,
    amount,
    purpose: "ADD_FUND",
    status: "CREATED",
  });

  // Ledger txn
  await WalletTxn.create({
    userId,
    type: "CREDIT",
    amount,
    reason: "ADD_FUND",
    status: "PENDING",
    provider: "RAZORPAY",
    razorpayOrderId: order.id,
  });

  res.json({
    orderId: order.id,
    amount,
    currency: "INR",
    key: process.env.RAZORPAY_KEY_ID,
  });
};
