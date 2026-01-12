const mongoose = require("mongoose");

const WeeklyPayoutSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  pairAmount: { type: Number, default: 0 },
  bonusCash: { type: Number, default: 0 },
  payoutAmount: { type: Number, default: 0 },
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

    
}, { timestamps: true });

module.exports = mongoose.model("WeeklyPayout", WeeklyPayoutSchema);
