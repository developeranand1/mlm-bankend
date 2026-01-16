const express = require("express");
const router = express.Router();
const { getAllUserRanks, deleteUserRank , getUserRankByUserId} = require("../controllers/userRank.controller");

router.get("/ranks", getAllUserRanks)
router.delete("/ranks/:id", deleteUserRank);

router.get("/ranks/:userId", getUserRankByUserId);



module.exports = router;