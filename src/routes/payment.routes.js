

const router = require("express").Router();
const auth = require("../middlewares/auth.middleware"); // aapka jwt auth middleware
const paymentController = require("../controllers/payment.controller");

// PRODUCT BUY WITH RAZORPAY
router.post("/product/:productId/create-order", auth, paymentController.createProductOrder);
router.post("/product/:productId/verify", auth, paymentController.verifyProductPayment);

module.exports = router;

