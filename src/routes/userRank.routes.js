const express = require("express");
const router = express.Router();
const { getAllUserRanks, deleteUserRank } = require("../controllers/userRank.controller");

router.get("/ranks", getAllUserRanks)
router.delete("/ranks/:id", deleteUserRank);


module.exports = router;