const express = require("express");
const router = express.Router();
const adminTree = require("../controllers/adminTree.controller");


// REMOVE node from tree (detach)
router.patch(
  "/tree/unlink/:userId",

  adminTree.unlinkNodeFromTree
);

// MOVE node to another parent
router.patch(
  "/tree/relocate/:userId",

  adminTree.relocateTreeNode
);

// INSERT node in between parent & child
router.patch(
  "/tree/insert-intermediate",

  adminTree.insertIntermediateNode
);

router.patch(
  "/tree/reparent/:nodeId",

  adminTree.reparentTreeNode
);

module.exports = router;
