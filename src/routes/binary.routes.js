const express = require("express");


const router = express.Router();

const mongoose = require("mongoose");
const User = require("../models/User");
const {
  findRootId,
  recalcPairsDFS,
} = require("../services/pair.service"); // 👈 yahi se import


router.post("/:parentId/tree/add", async (req, res) => {
  const { parentId } = req.params;
  const { childId, side } = req.body;

  if (!mongoose.Types.ObjectId.isValid(parentId)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid parentId" });
  }
  if (!mongoose.Types.ObjectId.isValid(childId)) {
    return res.status(400).json({ success: false, message: "Invalid childId" });
  }
  if (!["left", "right"].includes(side)) {
    return res
      .status(400)
      .json({ success: false, message: "side must be 'left' or 'right'" });
  }
  if (parentId === childId) {
    return res.status(400).json({
      success: false,
      message: "Parent and child cannot be same user",
    });
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const [parent, child] = await Promise.all([
        User.findById(parentId).session(session),
        User.findById(childId).session(session),
      ]);

      if (!parent) throw new Error("Parent user not found");
      if (!child) throw new Error("Child user not found");

      if (child.referredBy) {
        throw new Error(
          "Child is already attached to a parent (referredBy exists)"
        );
      }
      if (!parent.isActive) {
        throw new Error("Parent user is inactive");
      }

      const referralField = side === "left" ? "leftReferral" : "rightReferral";
      const countField = side === "left" ? "leftCount" : "rightCount";

      if (parent[referralField]) {
        throw new Error(`Parent ${side} slot already occupied`);
      }

      // cycle protection
      let cursor = parent;
      while (cursor) {
        if (String(cursor._id) === String(child._id)) {
          throw new Error(
            "Cycle detected: cannot place parent under its descendant"
          );
        }
        if (!cursor.referredBy) break;
        cursor = await User.findById(cursor.referredBy).session(session);
      }

      // 1) attach child
      parent[referralField] = child._id;
      parent[countField] = (parent[countField] || 0) + 1;

      await User.updateOne(
        { _id: parent._id },
        { $addToSet: { downline: child._id } },
        { session }
      );

      child.referredBy = parent._id;

      await Promise.all([parent.save({ session }), child.save({ session })]);

      // 2) upline counts + downline push
      let currentNodeId = parent._id;
      let uplineId = parent.referredBy;

      while (uplineId) {
        const upline = await User.findById(uplineId).session(session);
        if (!upline) break;

        const isLeftChain =
          upline.leftReferral &&
          String(upline.leftReferral) === String(currentNodeId);

        const incField = isLeftChain ? "leftCount" : "rightCount";

        await User.updateOne(
          { _id: upline._id },
          {
            $inc: { [incField]: 1 },
            $addToSet: { downline: child._id },
          },
          { session }
        );

        currentNodeId = upline._id;
        uplineId = upline.referredBy;
      }

      // 3) ✅ EXACTLY REGISTER/APPROVE WALA LOGIC:
      // root se pairCount + pairAmount recalc
      const rootId = await findRootId(parent._id, session);
      if (rootId) {
        await recalcPairsDFS(rootId, session);
      }

      // ❌ Yahan alag se upsertUserRankByPairCount ki zarurat nahi,
      // recalcPairsDFS already rank + payPairsForUser dono kar raha hai.
    });

    return res.status(200).json({
      success: true,
      message:
        "User added to tree successfully (pairCount + pairAmount + rank updated)",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to add user to tree",
    });
  } finally {
    session.endSession();
  }
});


module.exports = router;
