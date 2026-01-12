const express = require("express");
const router = express.Router();
const runWeeklyPayoutJob = require("../services/weeklyPayoutJob");

router.post("/run", async (req, res) => {
  try {
    await runWeeklyPayoutJob();
    res.json({ success: true, message: "Weekly payout created manually" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error running payout" });
  }
});

module.exports = router;
