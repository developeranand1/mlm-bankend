const express = require("express");
const router = express.Router();
const { getKycList,getKycById ,updateKycStatus,getKycByUserId} = require("../controllers/kyc.controller");


// GET all kycs with user data
router.get("/", getKycList);
router.get("/get-by-id/:id", getKycById);
router.patch("/kyc-status/:kycId/", updateKycStatus);
router.get("/user/:userId", getKycByUserId);

module.exports = router;
