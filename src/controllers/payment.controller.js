const crypto = require("crypto");
const mongoose = require("mongoose");
const PaymentOrder = require("../models/PaymentOrder");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { razorpay } = require("../config/razorpay");


exports.createProductOrder = async (req, res) => {
  try {
    console.log("REQ.USER =>", req.user);

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = req.user._id;
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const amount = Number(product.price);

    const rpOrder = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `PRD_${Date.now()}`, // ✅ FIXED (<= 40 chars)
      notes: {
        productId: String(productId),
        userId: String(userId),
      },
    });

    await PaymentOrder.create({
      userId,
      razorpayOrderId: rpOrder.id,
      amount,
      currency: "INR",
      status: "CREATED",
      purpose: "PRODUCT_BUY",
    });

    return res.json({
      message: "Razorpay order created",
      orderId: rpOrder.id,
      amount,
      currency: "INR",
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.error?.description || err.message });
  }
};



exports.verifyProductPayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing razorpay fields" });
    }

    // signature verify
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    await session.withTransaction(async () => {
      const payOrder = await PaymentOrder.findOne({
        userId,
        razorpayOrderId: razorpay_order_id,
        status: "CREATED",
        purpose: "PRODUCT_BUY",
      }).session(session);

      if (!payOrder) throw new Error("PaymentOrder not found or already processed");

      const product = await Product.findById(productId).session(session);
      if (!product) throw new Error("Product not found");

      // mark payment success
      payOrder.status = "PAID";
      payOrder.razorpayPaymentId = razorpay_payment_id;
      payOrder.razorpaySignature = razorpay_signature;
      await payOrder.save({ session });

      // create Order in DB
    await Order.create(
  [
    {
      userId,
      items: [{ productId, price: product.price }],
      amount: product.price,              // ✅ ADD THIS (required by schema)
      totalAmount: product.price,         // keep if you want
      paymentMethod: "RAZORPAY",
      status: "PAID",
      razorpay: { orderId: razorpay_order_id, paymentId: razorpay_payment_id },
    },
  ],
  { session }
);

    });

    session.endSession();
    return res.json({ message: "Payment verified & product order placed successfully" });
  } catch (err) {
    session.endSession();
    console.error(err);
    return res.status(500).json({ message: "Verify product payment failed", error: err.message });
  }
};
