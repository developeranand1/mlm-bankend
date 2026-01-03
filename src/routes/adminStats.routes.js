const express = require("express");
const router = express.Router();

const { getAdminDashboardStats } = require("../controllers/adminStats.controller");


router.get("/stats", getAdminDashboardStats);

module.exports = router;
