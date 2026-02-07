const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const router = express.Router();

const Payment = require("../models/Payment");
const ProductOrder = require("../models/ProductOrder");
const Product = require("../models/Product");
const { razorpay } = require("../config/razorpay");


router.post("/create", async (req, res) => {
  try {
    const { address, productId } = req.body;

    if (!address || !productId) {
      return res.status(400).json({ message: "address & productId required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const amount = product.price;

    const rpOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `DIR_${Date.now()}`,
    });

    await Payment.create({
      razorpayOrderId: rpOrder.id,
      amount,
      meta: {
        productId: product._id,
        price: product.price,
        address,
      },
    });

    res.json({
      orderId: rpOrder.id,
      amount,
      key: process.env.RAZORPAY_KEY_ID,
      prefill: {
        name: address.fullName,
        email: address.email,
        contact: address.phone,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


router.post("/verify", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    await session.withTransaction(async () => {
      const payment = await Payment.findOne({
        razorpayOrderId: razorpay_order_id,
        status: "CREATED",
      }).session(session);

      if (!payment) {
        throw new Error("Payment record not found");
      }

      payment.status = "PAID";
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      await payment.save({ session });

      await ProductOrder.create(
        [
          {
            items: [
              {
                productId: payment.meta.productId,
                qty: 1,
                price: payment.meta.price,
              },
            ],
            amount: payment.amount,
            address: payment.meta.address,
            payment: {
              razorpayOrderId: razorpay_order_id,
              razorpayPaymentId: razorpay_payment_id,
            },
            status: "PAID",
          },
        ],
        { session }
      );
    });

    session.endSession();
    res.json({ message: "Payment success & order placed" });
  } catch (err) {
    session.endSession();
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


router.get("/orders/success", async (req, res) => {
  try {
    const orders = await ProductOrder.find({ status: "PAID" })
      .populate("items.productId", "name price image")
      .sort({ createdAt: -1 });

    res.json({
      total: orders.length,
      orders,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


router.get("/list", async (req, res) => {
  try {
    const payments = await Payment.find()
      .sort({ createdAt: -1 })
      .populate("meta.productId", "name price image");

    res.json({
      total: payments.length,
      payments,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;