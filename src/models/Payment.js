const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    status: {
      type: String,
      enum: ["CREATED", "PAID", "FAILED"],
      default: "CREATED",
    },

    razorpayPaymentId: String,
    razorpaySignature: String,

    // 👇 direct form + product data
    meta: {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },

      price: {
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
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
