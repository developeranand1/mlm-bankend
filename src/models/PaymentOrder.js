// // models/PaymentOrder.js
// const mongoose = require("mongoose");

// const PaymentOrderSchema = new mongoose.Schema(
//   {
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
//     razorpayOrderId: { type: String, unique: true, sparse: true },

//     amount: { type: Number, required: true }, // INR
//     currency: { type: String, default: "INR" },

//     status: { type: String, enum: ["CREATED", "PAID", "FAILED"], default: "CREATED" },

//     razorpayPaymentId: String,
//     razorpaySignature: String,

//     purpose: { type: String, enum: ["ADD_FUND", "BUY_PRODUCT"], default: "ADD_FUND" },

//     meta: {
//       productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
//     },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("PaymentOrder", PaymentOrderSchema);


// src/models/PaymentOrder.js
const mongoose = require("mongoose");

const PaymentOrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    razorpayOrderId: { type: String, unique: true, sparse: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["CREATED", "PAID", "FAILED"], default: "CREATED" },

    razorpayPaymentId: String,
    razorpaySignature: String,

    // ✅ Make it enum so wrong values na aaye
    purpose: { type: String, enum: ["ADD_FUND", "PRODUCT_BUY", "CART_BUY"], default: "ADD_FUND" },

    meta: { type: Object }, // productId/items etc store karne ke liye
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentOrder", PaymentOrderSchema);
