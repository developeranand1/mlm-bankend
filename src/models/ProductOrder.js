const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
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
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],

    amount: {
      type: Number,
      required: true,
    },

    address: {
      fullName: String,
      phone: String,
      email: String,
      line1: String,
      line2: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
    },

    paymentMethod: {
      type: String,
      enum: ["RAZORPAY"],
      default: "RAZORPAY",
    },

    payment: {
      razorpayOrderId: String,
      razorpayPaymentId: String,
    },

    status: {
      type: String,
      enum: ["PAID", "CANCELLED"],
      default: "PAID",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductOrder", orderSchema);
