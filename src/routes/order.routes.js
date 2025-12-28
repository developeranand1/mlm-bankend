const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const orderController = require("../controllers/order.controller");

// ✅ user: my orders
router.get("/my-orders", orderController.myOrders);

// ✅ admin/other: params userId
router.get("/user/:userId", orderController.ordersByUserId);

// ✅ optional: order detail
router.get("/:orderId", orderController.orderById);

module.exports = router;
