const router = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const walletCtrl = require("../controllers/wallet.controller");


router.post("/wallet/add-fund/order", walletCtrl.createAddFundOrder);
router.post("/wallet/add-fund/verify", walletCtrl.verifyAddFund);



module.exports = router;
