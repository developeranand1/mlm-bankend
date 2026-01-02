const router = require("express").Router();
const ctrl = require("../controllers/withdrawal.controller");
const userAuth = require("../middlewares/auth.middleware");
const upload = require("../middlewares/withdrawal-images.middleware"); 

// USER
router.post("/withdrawals", userAuth, ctrl.createWithdrawal);
router.get("/withdrawals/my", userAuth, ctrl.myWithdrawals);
router.post("/withdrawals/:id/cancel", userAuth, ctrl.cancelWithdrawal);

// ADMIN
router.get("/admin/withdrawals", ctrl.adminListWithdrawals);
router.post("/admin/withdrawals/:id/approve",ctrl.approveWithdrawal);
router.post("/admin/withdrawals/:id/processing", ctrl.markProcessing);
router.get("/admin/withdrawals/export", ctrl.exportWithdrawalsCSV);
router.post("/admin/withdrawals/:id/reject", ctrl.rejectWithdrawal);

router.post(
  "/admin/withdrawals/:id/pay",
  upload.single("proofImage"),   // form-data key MUST be proofImage
  ctrl.markPaidWithProof
);

module.exports = router;
