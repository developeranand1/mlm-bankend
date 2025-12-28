const mongoose = require("mongoose");

const walletTxnSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

    type: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    amount: { type: Number, required: true },

    reason: {
      type: String,
      enum: ["ADD_FUND", "PRODUCT_PURCHASE", "WITHDRAWAL", "ADMIN_ADJUSTMENT"],
      required: true,
    },

    status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED"], default: "PENDING" },

    // Track balance movement
    openingBalance: { type: Number, default: 0 },
    closingBalance: { type: Number, default: 0 },

    // For linking to orders/payments/products
    referenceId: { type: String, index: true }, // e.g. orderId, purchaseId, productId

    // Payment Provider
    provider: { type: String, enum: ["RAZORPAY", "NONE"], default: "NONE" },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true }, // idempotency
    razorpaySignature: String,

    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WalletTransaction", walletTxnSchema);
