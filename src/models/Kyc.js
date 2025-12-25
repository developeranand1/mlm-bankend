const mongoose = require("mongoose");

const KycSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  passbookImage: { type: String },
  accountHolderName: { type: String },
  bankAccountNumber: { type: String },
  bankName: { type: String },
  bankType: String,
  ifscCode: { type: String },
  aadharNumber: { type: String },
  panNumber: { type: String },
  aadharImage: { type: String },
  panImage: { type: String },
  status: { type: String, default: "pending" },
});

module.exports = mongoose.model("Kyc", KycSchema);
