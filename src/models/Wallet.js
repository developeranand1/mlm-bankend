const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true,
      sparse: true,   // ⭐ MOST IMPORTANT
      index: true },
    balance: { type: Number, default: 0 }, // in rupees (or use paise everywhere)
    locked: { type: Number, default: 0 },  // optional: for pending withdrawals
  },
  { timestamps: true }
);

module.exports = mongoose.model("Wallet", walletSchema);
