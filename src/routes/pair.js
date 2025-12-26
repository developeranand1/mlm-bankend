// const User = require("../models/User");
// const { getPairStatus } = require("../utils/pair.utils");
// const express = require("express");


// const router = express.Router();

// router.get('/status/:id', async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id).select(
//       "name leftCount rightCount pairPaid"
//     );

//     if (!user) {
//       return res.status(404).json({ ok: false, error: "User not found" });
//     }

//     const pairStatus = getPairStatus(user);

//     res.json({
//       ok: true,
//       user: {
//         id: user._id,
//         name: user.name,
//       },
//       pairStatus,
//     });
//   } catch (e) {
//     res.status(500).json({ ok: false, error: e.message });
//   }
// });

// module.exports = router;


const express = require("express");
const User = require("../models/User");
const { getPairStatus } = require("../utils/pair.utils");

const router = express.Router();

router.get("/status/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name leftCount rightCount pairPaid"
    );

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: "User not found",
      });
    }

    const pairStatus = getPairStatus(user);

    return res.json({
      ok: true,
      user: {
        id: user._id,
        name: user.name,
      },
      pairStatus,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

module.exports = router;

