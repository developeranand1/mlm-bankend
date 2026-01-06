const mongoose = require("mongoose");
const User = require("../models/User");
const {
  findRootId,
  recalcPairsDFS,
  upsertUserRankByPairCount,
} = require("../utils/pairsRank");

/* ======================================================
   HELPERS
====================================================== */

// find parent by checking left/right pointers
async function findParentOf(childId, session) {
  return User.findOne({
    $or: [{ leftReferral: childId }, { rightReferral: childId }],
  }).session(session);
}

// check if possibleChild lies inside target subtree (cycle protection)
async function isDescendant(targetId, possibleChildId, session) {
  const stack = [targetId];
  const visited = new Set();

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;

    const key = String(current);
    if (visited.has(key)) continue;
    visited.add(key);

    if (String(current) === String(possibleChildId)) return true;

    const node = await User.findById(current)
      .select("leftReferral rightReferral")
      .lean()
      .session(session);

    if (!node) continue;

    if (node.leftReferral) stack.push(node.leftReferral);
    if (node.rightReferral) stack.push(node.rightReferral);
  }

  return false;
}

/* ======================================================
   1️⃣ UNLINK NODE (DETACH FROM TREE)
   PATCH /admin/tree/unlink/:userId
====================================================== */

exports.unlinkNodeFromTree = async (req, res) => {
  const { userId } = req.params;
  const session = await mongoose.startSession();

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    await session.withTransaction(async () => {
      const target = await User.findById(userId).session(session);
      if (!target) throw new Error("User not found");

      const parent = await findParentOf(target._id, session);

      if (parent) {
        // remove from left/right slot
        if (String(parent.leftReferral) === String(target._id)) {
          parent.leftReferral = null;
        } else if (String(parent.rightReferral) === String(target._id)) {
          parent.rightReferral = null;
        }
        await parent.save({ session });
      }

      // detach target
      target.referredBy = null;
      await target.save({ session });

      // recalc whole tree
      const rootId = await findRootId(target._id, session);
      if (rootId) await recalcPairsDFS(rootId, session);

      await upsertUserRankByPairCount(
        target._id,
        target.pairCount || 0,
        session
      );
    });

    return res.json({
      success: true,
      message: "User unlinked from tree successfully",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Unlink failed",
    });
  } finally {
    session.endSession();
  }
};



exports.relocateTreeNode = async (req, res) => {
  const { userId } = req.params;
  const { newParentId, side } = req.body;
  const session = await mongoose.startSession();

  try {
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(newParentId)
    ) {
      return res.status(400).json({ success: false, message: "Invalid IDs" });
    }

    if (!["left", "right"].includes(side)) {
      return res
        .status(400)
        .json({ success: false, message: "side must be left or right" });
    }

    await session.withTransaction(async () => {
      const [target, newParent] = await Promise.all([
        User.findById(userId).session(session),
        User.findById(newParentId).session(session),
      ]);

      if (!target) throw new Error("Target user not found");
      if (!newParent) throw new Error("New parent not found");

      // cycle protection
      const cycle = await isDescendant(target._id, newParent._id, session);
      if (cycle) {
        throw new Error(
          "Cycle detected: cannot move node under its own downline"
        );
      }

      // detach from old parent
      const oldParent = await findParentOf(target._id, session);
      if (oldParent) {
        if (String(oldParent.leftReferral) === String(target._id)) {
          oldParent.leftReferral = null;
        } else if (String(oldParent.rightReferral) === String(target._id)) {
          oldParent.rightReferral = null;
        }
        await oldParent.save({ session });
      }

      // attach to new parent
      const slot = side === "left" ? "leftReferral" : "rightReferral";
      if (newParent[slot]) {
        throw new Error(`New parent ${side} slot already occupied`);
      }

      newParent[slot] = target._id;
      target.referredBy = newParent._id;

      await Promise.all([
        newParent.save({ session }),
        target.save({ session }),
      ]);

      // recalc from root
      const rootId = await findRootId(newParent._id, session);
      if (rootId) await recalcPairsDFS(rootId, session);

      await upsertUserRankByPairCount(
        target._id,
        target.pairCount || 0,
        session
      );
    });

    return res.json({
      success: true,
      message: "User relocated successfully",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Relocate failed",
    });
  } finally {
    session.endSession();
  }
};



exports.insertIntermediateNode = async (req, res) => {
  const { parentId, side, newNodeId, attachOldChildTo = "left" } = req.body;
  const session = await mongoose.startSession();

  try {
    if (
      !mongoose.Types.ObjectId.isValid(parentId) ||
      !mongoose.Types.ObjectId.isValid(newNodeId)
    ) {
      return res.status(400).json({ success: false, message: "Invalid IDs" });
    }

    if (!["left", "right"].includes(side)) {
      return res.status(400).json({ success: false, message: "Invalid side" });
    }

    await session.withTransaction(async () => {
      const [parent, newNode] = await Promise.all([
        User.findById(parentId).session(session),
        User.findById(newNodeId).session(session),
      ]);

      if (!parent) throw new Error("Parent not found");
      if (!newNode) throw new Error("New node not found");

      // new node must be free
      const existingParent = await findParentOf(newNode._id, session);
      if (existingParent) {
        throw new Error("New node already exists in tree");
      }

      const parentSlot = side === "left" ? "leftReferral" : "rightReferral";
      const oldChildId = parent[parentSlot];
      if (!oldChildId) {
        throw new Error("No existing child to insert between");
      }

      const oldChild = await User.findById(oldChildId).session(session);
      if (!oldChild) throw new Error("Old child not found");

      // parent -> newNode
      parent[parentSlot] = newNode._id;
      newNode.referredBy = parent._id;

      // newNode -> oldChild
      const childSlot =
        attachOldChildTo === "right" ? "rightReferral" : "leftReferral";
      newNode[childSlot] = oldChild._id;
      oldChild.referredBy = newNode._id;

      await Promise.all([
        parent.save({ session }),
        newNode.save({ session }),
        oldChild.save({ session }),
      ]);

      const rootId = await findRootId(parent._id, session);
      if (rootId) await recalcPairsDFS(rootId, session);

      await upsertUserRankByPairCount(
        newNode._id,
        newNode.pairCount || 0,
        session
      );
    });

    return res.json({
      success: true,
      message: "Intermediate node inserted successfully",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Insert failed",
    });
  } finally {
    session.endSession();
  }
};

// helper: find current parent by left/right pointers
async function findParentOf(childId, session) {
  return User.findOne({
    $or: [{ leftReferral: childId }, { rightReferral: childId }],
  }).session(session);
}

// helper: cycle protection (newParent cannot be inside node's subtree)
async function isDescendant(targetId, possibleDescendantId, session) {
  const stack = [targetId];
  const visited = new Set();

  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;

    const key = String(cur);
    if (visited.has(key)) continue;
    visited.add(key);

    if (String(cur) === String(possibleDescendantId)) return true;

    const node = await User.findById(cur)
      .select("leftReferral rightReferral")
      .lean()
      .session(session);

    if (!node) continue;
    if (node.leftReferral) stack.push(node.leftReferral);
    if (node.rightReferral) stack.push(node.rightReferral);
  }
  return false;
}

/**
 * PATCH /admin/tree/reparent/:nodeId
 * Cut the node from its current parent and attach under newParentId at side.
 * Subtree moves along with the node.
 */
exports.reparentTreeNode = async (req, res) => {
  const { nodeId } = req.params;
  const { newParentId, side } = req.body;

  const session = await mongoose.startSession();

  try {
    if (!mongoose.Types.ObjectId.isValid(nodeId)) {
      return res.status(400).json({ success: false, message: "Invalid nodeId" });
    }
    if (!mongoose.Types.ObjectId.isValid(newParentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid newParentId" });
    }
    if (!["left", "right"].includes(side)) {
      return res
        .status(400)
        .json({ success: false, message: "side must be 'left' or 'right'" });
    }
    if (String(nodeId) === String(newParentId)) {
      return res
        .status(400)
        .json({ success: false, message: "Node cannot be its own parent" });
    }

    await session.withTransaction(async () => {
      const [node, newParent] = await Promise.all([
        User.findById(nodeId).session(session),
        User.findById(newParentId).session(session),
      ]);

      if (!node) throw new Error("Node not found");
      if (!newParent) throw new Error("New parent not found");
      if (!newParent.isActive) throw new Error("New parent is inactive");

      // ✅ cycle protection: cannot attach node under its own descendant
      const cycle = await isDescendant(node._id, newParent._id, session);
      if (cycle) {
        throw new Error(
          "Cycle detected: cannot attach node under its own downline"
        );
      }

      // ✅ also ensure newParent slot is empty
      const slot = side === "left" ? "leftReferral" : "rightReferral";
      if (newParent[slot]) {
        throw new Error(`New parent ${side} slot already occupied`);
      }

      // 1) CUT: detach node from old parent (if exists)
      const oldParent = await findParentOf(node._id, session);
      if (oldParent) {
        if (oldParent.leftReferral && String(oldParent.leftReferral) === String(node._id)) {
          oldParent.leftReferral = null;
        } else if (
          oldParent.rightReferral &&
          String(oldParent.rightReferral) === String(node._id)
        ) {
          oldParent.rightReferral = null;
        }
        await oldParent.save({ session });
      }

      // Also nullify referredBy first
      node.referredBy = null;
      await node.save({ session });

      // 2) PASTE: attach to new parent
      newParent[slot] = node._id;
      node.referredBy = newParent._id;

      await Promise.all([
        newParent.save({ session }),
        node.save({ session }),
      ]);

      // 3) ✅ Recalculate pairs/ranks from root (safe)
      const rootId = await findRootId(newParent._id, session);
      if (rootId) await recalcPairsDFS(rootId, session);

      // ensure rank updated
      await upsertUserRankByPairCount(node._id, node.pairCount || 0, session);
    });

    return res.status(200).json({
      success: true,
      message: "Node reparented successfully (cut + paste done)",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Reparent failed",
    });
  } finally {
    session.endSession();
  }
};