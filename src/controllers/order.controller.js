const mongoose = require("mongoose");
const Order = require("../models/Order");

// ✅ USER: apne orders (token userId se)
exports.myOrders = async (req, res) => {
  try {


    const orders = await Order.find()
    .populate({
        path: "userId",
        select: "name email phone", // jo fields chahiye wo hi bhejo
      })
     .populate("items.productId")
      .sort({ createdAt: -1 })
     

    return res.json({ message: "My orders", count: orders.length, orders });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch orders", error: err.message });
  }
};

// ✅ ADMIN/ANY: params se userId lekar orders
exports.ordersByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .populate("items.productId"); // optional

    return res.json({ message: "User orders", count: orders.length, orders });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch user orders", error: err.message });
  }
};

// ✅ single order by id (optional)
exports.orderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
    }

    const order = await Order.findById(orderId).populate("items.productId");
    if (!order) return res.status(404).json({ message: "Order not found" });

    return res.json({ message: "Order detail", order });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch order", error: err.message });
  }
};
