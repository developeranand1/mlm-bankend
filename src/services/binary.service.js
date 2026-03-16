const User = require("../models/User");

// side: "L" or "R"
function normalizeSide(side) {
  const s = (side || "L").toUpperCase();
  if (s !== "L" && s !== "R") throw new Error("side must be 'L' or 'R'");
  return s;
}

async function findPlacementBFS({ startUserId, side, session }) {
  // BFS queue
  const queue = [startUserId];

  while (queue.length) {
    const currentId = queue.shift();
    const current = await User.findById(currentId).session(session);
    if (!current) throw new Error("User not found");

    const left = current.leftReferral;
    const right = current.rightReferral;

    // We are searching within ONE side subtree from start
    // First node is sponsor itself: we check sponsor's chosen side
    if (String(currentId) === String(startUserId)) {
      if (side === "L") {
        if (!left) return { parentId: current._id, position: "L" };
        queue.push(left);
      } else {
        if (!right) return { parentId: current._id, position: "R" };
        queue.push(right);
      }
      continue;
    }

    // For deeper nodes, we follow full binary fill (left then right)
    if (!left) return { parentId: current._id, position: "L" };
    if (!right) return { parentId: current._id, position: "R" };

    queue.push(left);
    queue.push(right);
  }

  throw new Error("No placement found");
}
// Recommended: parentBinary field add karna for accurate upward counts.
// Hum yaha without schema change bhi kar sakte by searching parent each time (slow).
async function findBinaryParent(childId, session) {
  return User.findOne({
    $or: [{ leftReferral: childId }, { rightReferral: childId }],
  }).session(session);
}

async function incrementCountsToRoot({ parentId, placedSide, session }) {
  // Walk upwards using parent links (searched) and update leftCount/rightCount
  let currentParentId = parentId;
  let side = placedSide; // side of the child relative to currentParent

  while (currentParentId) {
    const parent = await User.findById(currentParentId).session(session);
    if (!parent) break;

    if (side === "L") parent.leftCount += 1;
    else parent.rightCount += 1;

    await parent.save({ session });

    // move up: find parent's parent
    const grandParent = await findBinaryParent(parent._id, session);
    if (!grandParent) break;

    // determine parent side relative to grandParent
    side = String(grandParent.leftReferral) === String(parent._id) ? "L" : "R";
    currentParentId = grandParent._id;
  }
}

// async function placeUserBinary({ newUserId, sponsorId, side, session }) {
//   const s = normalizeSide(side);

//   const sponsor = await User.findById(sponsorId).session(session);
//   if (!sponsor) throw new Error("Sponsor not found");

//   // 1) Find placement using BFS starting from sponsor on chosen side
//   const { parentId, position } = await findPlacementBFS({
//     startUserId: sponsor._id,
//     side: s,
//     session,
//   });

//   // 2) Attach newUser under parent
//   const parent = await User.findById(parentId).session(session);
//   if (!parent) throw new Error("Parent not found");

//   if (position === "L") {
//     if (parent.leftReferral) throw new Error("Left already occupied");
//     parent.leftReferral = newUserId;
//   } else {
//     if (parent.rightReferral) throw new Error("Right already occupied");
//     parent.rightReferral = newUserId;
//   }

//   // optional: downline push
//   parent.downline.push(newUserId);

//   await parent.save({ session });

//   // 3) Update counts upwards (accurate but slower, works)
//   await incrementCountsToRoot({ parentId: parent._id, placedSide: position, session });

//   return { parentId: parent._id, position, sponsorId: sponsor._id };
// }


async function findLeafByDirection(nodeId, side, session) {
  const node = await User.findById(nodeId)
    .select("_id leftReferral rightReferral")
    .session(session);

  if (!node) {
    throw new Error("Node not found while traversing tree");
  }

  if (side === "L") {
    if (!node.leftReferral) return node;
    return await findLeafByDirection(node.leftReferral, "L", session);
  }

  if (side === "R") {
    if (!node.rightReferral) return node;
    return await findLeafByDirection(node.rightReferral, "R", session);
  }

  throw new Error("Invalid side. Must be L or R");
}

async function placeUserBinary({ newUserId, sponsorId, side = "L", session }) {
  const normalizedSide = String(side || "L").trim().toUpperCase();

  if (!["L", "R"].includes(normalizedSide)) {
    throw new Error("Invalid side. Must be L or R");
  }

  const sponsor = await User.findById(sponsorId)
    .select("_id leftReferral rightReferral")
    .session(session);

  if (!sponsor) {
    throw new Error("Sponsor not found");
  }

  const leafNode = await findLeafByDirection(
    sponsor._id,
    normalizedSide,
    session
  );

  if (!leafNode) {
    throw new Error("Could not find placement node");
  }

  let updateResult;

  if (normalizedSide === "L") {
    updateResult = await User.updateOne(
      { _id: leafNode._id, leftReferral: null },
      { $set: { leftReferral: newUserId } },
      { session }
    );
  } else {
    updateResult = await User.updateOne(
      { _id: leafNode._id, rightReferral: null },
      { $set: { rightReferral: newUserId } },
      { session }
    );
  }

  if (updateResult.modifiedCount === 0) {
    throw new Error(
      `Placement failed. ${normalizedSide} slot already filled, please retry.`
    );
  }

  // Important:
  // referredBy sponsor hi rehna chahiye ya placement parent?
  // Agar tum binary parent ko chain me rakhna chahte ho to leafNode._id use karo.
  // Agar sponsor chain alag maintain karni hai to sponsorId use karo.
  // Abhi binary/upline propagation ke hisaab se leafNode parent rakh rahe hain.
  await User.updateOne(
    { _id: newUserId },
    { $set: { referredBy: leafNode._id } },
    { session }
  );

  return {
    parentId: leafNode._id,
    placedSide: normalizedSide,
    sponsorId: sponsor._id,
  };
}

function computeNewPairs(user) {
  const totalPairs = Math.min(user.leftCount, user.rightCount);
  const newPairs = totalPairs - (user.pairPaid || 0);
  return newPairs > 0 ? newPairs : 0;
}

module.exports = {
  placeUserBinary,
  computeNewPairs,
};
