// models/PairPayoutLedger.js
const mongoose = require("mongoose");

const PairPayoutLedgerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },

    pairsPaidNow: { type: Number, required: true },
    amount: { type: Number, required: true },

    leftCountSnapshot: { type: Number, required: true },
    rightCountSnapshot: { type: Number, required: true },
    pairPaidSnapshotBefore: { type: Number, required: true },
  },
  { timestamps: true }
);

PairPayoutLedgerSchema.index({ user: 1, weekStart: 1, weekEnd: 1 }, { unique: true });

module.exports = mongoose.model("PairPayoutLedger", PairPayoutLedgerSchema);
