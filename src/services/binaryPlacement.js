// services/binaryPlacement.js
const User = require("../models/User");

/**
 * Find placement parent under sponsor in given side ('L'/'R') using BFS.
 * Returns { parentUser, sideToAttach: 'leftReferral'|'rightReferral' }
 */
async function findBinaryPlacement(sponsorId, preferredSide) {
  const sponsor = await User.findById(sponsorId).lean();
  if (!sponsor) throw new Error("Sponsor not found");

  const sideField = preferredSide === "R" ? "rightReferral" : "leftReferral";

  // 1) If sponsor has empty on preferred side, place directly
  if (!sponsor[sideField]) {
    return { parentUser: sponsor, sideToAttach: sideField };
  }

  // 2) BFS from that child to find first empty
  const startChildId = sponsor[sideField];
  const queue = [startChildId];

  while (queue.length) {
    const nodeId = queue.shift();
    const node = await User.findById(nodeId).lean();
    if (!node) continue;

    if (!node.leftReferral) return { parentUser: node, sideToAttach: "leftReferral" };
    if (!node.rightReferral) return { parentUser: node, sideToAttach: "rightReferral" };

    queue.push(node.leftReferral, node.rightReferral);
  }

  throw new Error("No placement found (unexpected)"); // theoretically tree always has space
}

/**
 * After attaching a new user under placementParent,
 * update all ancestors' leftCount/rightCount up to root.
 */
async function updateCountsUpwards({ placementParentId, attachedSide, session }) {
  let currentParentId = placementParentId;
  let childId = null;
  let sideFromParent = attachedSide; // for first link

  while (currentParentId) {
    const parent = await User.findById(currentParentId).session(session);
    if (!parent) break;

    if (sideFromParent === "leftReferral") parent.leftCount += 1;
    else parent.rightCount += 1;

    await parent.save({ session });

    // move upward:
    // parent.placementParent = its parent in tree
    childId = parent._id;
    currentParentId = parent.placementParent;

    if (!currentParentId) break;

    const upper = await User.findById(currentParentId).select("leftReferral rightReferral").lean();
    if (!upper) break;

    // determine which side childId is from upper
    if (String(upper.leftReferral) === String(childId)) sideFromParent = "leftReferral";
    else if (String(upper.rightReferral) === String(childId)) sideFromParent = "rightReferral";
    else {
      // if inconsistent tree pointers, break to avoid wrong updates
      break;
    }
  }
}

module.exports = { findBinaryPlacement, updateCountsUpwards };
