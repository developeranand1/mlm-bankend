

const mongoose = require("mongoose");

const WeeklyPayoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pairAmount: { type: Number, default: 0 },
    bonusCash: { type: Number, default: 0 },


    payoutAmount: { type: Number, default: 0 },

    // 5% charge amount
    chargeAmount: { type: Number, default: 0 },

    // Net payout after charge (payoutAmount - chargeAmount)
    netPayoutAmount: { type: Number, default: 0 },

    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },

    paymentType: {
      type: String,
      enum: ["NEFT", "UPI", "IMPS", "WALLET", ""],
      default: "",
    },

    // Transaction ID (bank txn id / UPI txn id)
    transactionId: { type: String, default: "" },

    // Cloudinary proof URL (payment slip / screenshot)
    proofFileUrl: { type: String, default: "" },

    // Optional admin remark
    adminRemark: { type: String, default: "" },
  },
  { timestamps: true }
);

// ✅ OPTION 1: Normal callback style (NO async yaha)



// ✅ OPTION 2: Agar async style chahiye to upar wale hook ko comment kar do
WeeklyPayoutSchema.pre("save", async function () {
  const payout = this.payoutAmount || 0;
  this.chargeAmount = Number(((payout * 5) / 100).toFixed(2));
  this.netPayoutAmount = Number((payout - this.chargeAmount).toFixed(2));
  // Yaha next() NAHI likhna
});


module.exports = mongoose.model("WeeklyPayout", WeeklyPayoutSchema);

