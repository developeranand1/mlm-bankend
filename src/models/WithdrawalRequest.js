const mongoose = require("mongoose");

const WithdrawalRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    amount: { type: Number, required: true },

    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED", "PAID"], default: "PENDING" },

    remarks: String,

    payoutRef: String, // UTR / payoutId
    meta: Object,
  },
  { timestamps: true }
);

module.exports = mongoose.model("WithdrawalRequest", WithdrawalRequestSchema);
