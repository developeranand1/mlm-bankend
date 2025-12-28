const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const paymentListController = require("../controllers/paymentList.controller");

// USER (auth)
router.get("/my", paymentListController.myPayments);

// ADMIN-style (abhi auth hi; later admin middleware laga dena)
router.get("/all", paymentListController.allPayments);

// userId param (auth)
router.get("/user/:userId", paymentListController.paymentsByUserIdParam);

module.exports = router;
