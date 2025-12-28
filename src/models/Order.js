const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        qty: {
          type: Number,
          default: 1,
          min: 1,
        },
        price: {
          type: Number,
          required: true, // price at time of purchase
        },
      },
    ],

    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    amount: { type: Number, required: true }, // rupees
    paymentMethod: { type: String, enum: ["WALLET", "RAZORPAY"], default: "WALLET" },
    status: { type: String, enum: ["CREATED", "PAID", "CANCELLED"], default: "PAID" },
    walletTxnId: { type: mongoose.Schema.Types.ObjectId, ref: "WalletTransaction" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
