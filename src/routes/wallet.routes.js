// src/routes/walletRoutes.js
const express = require("express");
const router = express.Router();
const { claimRankBonus,listAllWallets,getWalletByUserId } = require("../controllers/wallet.controller");
const auth = require("../middlewares/auth.middleware"); 

router.post("/claim-rank-bonus", auth, claimRankBonus);
router.get("/all", listAllWallets);
router.get("/by-user/:userId", getWalletByUserId);

module.exports = router;
