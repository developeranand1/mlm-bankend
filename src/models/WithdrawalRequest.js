const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    amount: { type: Number, required: true, min: 1 },

    status: {
      type: String,
      enum: ["Requested", "Approved", "Processing", "Paid", "Rejected", "Cancelled"],
      default: "Requested",
      index: true,
    },

    // snapshot of bank details at time of request (avoid changing KYC later)
    bank: {
      accountHolderName: String,
      bankAccountNumber: String,
      bankName: String,
      ifscCode: String,
      upiId: String,
    },

    // admin info
    adminNote: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    approvedAt: Date,

    processedAt: Date, // when admin started transfer

    // payout proof
    proof: {
      utr: String,
      mode: { type: String, enum: ["NEFT", "RTGS", "IMPS", "UPI", "OTHER"] },
      paidAt: Date,
      proofUrl: String, // cloudinary url
      proofNote: String,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
      uploadedAt: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WithdrawalRequest", withdrawalSchema);
