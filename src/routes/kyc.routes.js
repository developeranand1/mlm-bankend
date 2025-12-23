const express = require("express");
const router = express.Router();
const { getKycList } = require("../controllers/kyc.controller");

// GET all kycs with user data
router.get("/", getKycList);

module.exports = router;
