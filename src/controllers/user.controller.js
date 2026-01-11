const User = require("../models/User");
const Kyc = require("../models/Kyc");
const cloudinary = require("../config/cloudinary");
const mongoose = require("mongoose");
// const User = require("../models/User");
const {
  findRootId,
  recalcPairsDFS,
  upsertUserRankByPairCount,
} = require("../utils/pairsRank");

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: "User" })
      // .select("-password")
      .populate("referredBy", "name username email")
      .populate("leftReferral", "name username")
      .populate("rightReferral", "name username")
      .sort({ createdAt: -1 });

    res.status(200).json({
      count: users.length,
      users,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getKycUsers = async (req, res) => {
  try {
    const kycs = await Kyc.find().populate("userId");
    res.json({ kycs });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

exports.updateKYC = async (req, res) => {
  const userIdFromParams = req.params.userId; // Extracting userId from URL params

  // Check if the request body is empty
  if (!req.body) {
    return res.status(400).json({ msg: "Request body is missing" });
  }

  const {
    aadharNumber,
    panNumber,
    passbookImage,
    bankName,
    bankType,
    accountHolderName,
    bankAccountNumber,
    ifscCode,
    kycStatus,
  } = req.body;

  try {
    // Check if the user exists
    let user = await User.findById(userIdFromParams);
    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    // Find the existing KYC record for the user
    let kyc = await Kyc.findOne({ userId: user._id });

    // If no KYC record exists, create a new one
    if (!kyc) {
      kyc = new Kyc({
        userId: user._id,
        aadharNumber: aadharNumber || "",
        bankName: bankName || "",
        bankType: bankType || "",
        panNumber: panNumber || "",
        status: kycStatus || "Pending", // Default status is 'Pending'
        accountHolderName: accountHolderName || "",
        bankAccountNumber: bankAccountNumber || "",
        ifscCode: ifscCode || "",
        // Initialize other fields as necessary
      });
    }

    // Upload Aadhar image to Cloudinary if provided
    if (req.files && req.files.aadharImage) {
      const aadharUploadResult = await cloudinary.uploader.upload(
        req.files.aadharImage[0].path,
        {
          folder: "mlm/kyc",
        }
      );
      kyc.aadharImage = aadharUploadResult.secure_url; // Save the image URL in KYC schema
    }

    // Upload PAN image to Cloudinary if provided
    if (req.files && req.files.panImage) {
      const panUploadResult = await cloudinary.uploader.upload(
        req.files.panImage[0].path,
        {
          folder: "mlm/kyc",
        }
      );
      kyc.panImage = panUploadResult.secure_url; // Save the image URL in KYC schema
    }

    // Upload Passbook image to Cloudinary if provided
    if (req.files && req.files.passbookImage) {
      const passbookUploadResult = await cloudinary.uploader.upload(
        req.files.passbookImage[0].path,
        {
          folder: "mlm/kyc",
        }
      );
      kyc.passbookImage = passbookUploadResult.secure_url; // Save the passbook image URL
    }

    // Update the KYC fields if provided
    if (aadharNumber) kyc.aadharNumber = aadharNumber;
    if (panNumber) kyc.panNumber = panNumber;
    if (bankType) kyc.bankType = bankType;
    if (bankName) kyc.bankName = bankName;

    if (accountHolderName) kyc.accountHolderName = accountHolderName;
    if (bankAccountNumber) kyc.bankAccountNumber = bankAccountNumber;
    if (ifscCode) kyc.ifscCode = ifscCode;
    if (kycStatus) kyc.status = kycStatus;

    // Save the updated KYC data
    await kyc.save();

    // Update user details like accountHolderName, bankAccountNumber, ifscCode, etc.
    user.accountHolderName = accountHolderName || user.accountHolderName;
    user.bankAccountNumber = bankAccountNumber || user.bankAccountNumber;
    user.ifscCode = ifscCode || user.ifscCode;
    user.bankName = bankName || user.bankName;
    user.bankType = bankType || user.bankType;

    // Save the updated user data
    await user.save();

    // Send response with updated KYC and user data
    res.json({ msg: "KYC and user details updated successfully", kyc, user });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate("kyc");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// recursive tree


exports.getUserTree = async (req, res) => {
  try {
    const { userId } = req.params;
    const depth = Number(req.query.depth || 10000000000);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid userId",
      });
    }

    const tree = await buildTree(userId, depth);

    if (!tree) {
      return res.status(404).json({
        ok: false,
        error: "User not found",
      });
    }

    return res.status(200).json({
      ok: true,
      userId,
      depth,
      tree,
    });
  } catch (err) {
    console.error("GET TREE ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
};

exports.getRootUsers = async (req, res) => {
  try {
    const users = await User.find({
      role: "User",
      referredBy: null,
      leftReferral:null,
      rightReferral:null,
      // status: "Approved",
    })
      .select(
        "username name email phone role referralCode leftReferral rightReferral leftCount rightCount createdAt"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};


exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    // Validate status
    if (!["Approved", "Reject", "Pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.status = status;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User status updated to ${status}`,
      data: user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const pickUser = (u) => ({
  id: u._id,
  name: u.name,
  username: u.username,
  email: u.email,
  phone: u.phone,
  role: u.role,
  referralCode: u.referralCode,
  isActive: u.isActive,
  leftCount: u.leftCount,
  rightCount: u.rightCount,
  pairCount: u.pairCount,
  pairPaid: u.pairPaid,
  createdAt: u.createdAt,
  status: u.status || "Pending",
});


async function buildTree(userId, depth = 10, visited = new Set()) {
  if (!userId) return null;
  if (depth <= 0) return null;

  const key = String(userId);
  if (visited.has(key)) return null; // prevent circular loop
  visited.add(key);

  const user = await User.findById(userId)
    .select(
      "name username email phone role referralCode isActive leftCount rightCount pairCount pairPaid createdAt leftReferral rightReferral referredBy status"
    )
    .populate("referredBy", "name email username status")
    .populate(
      "leftReferral",
      "name username email phone role referralCode isActive leftReferral rightReferral status"
    )
    .populate(
      "rightReferral",
      "name username email phone role referralCode isActive leftReferral rightReferral status"
    )
    .lean();

  if (!user) return null;

  // build children recursively using ids
  const leftId = user.leftReferral?._id || user.leftReferral;
  const rightId = user.rightReferral?._id || user.rightReferral;

  const leftSubTree = leftId
    ? await buildTree(leftId, depth - 1, visited)
    : null;
  const rightSubTree = rightId
    ? await buildTree(rightId, depth - 1, visited)
    : null;

  return {
    ...pickUser(user),
    referredBy: user.referredBy
      ? {
          id: user.referredBy._id,
          name: user.referredBy.name,
          email: user.referredBy.email,
          username: user.referredBy.username,
          status: user.referredBy.status || "Pending",
        }
      : null,
    children: {
      left: leftSubTree,
      right: rightSubTree,
    },
  };
}

exports.addUserToTree = async (req, res) => {
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
    return res
      .status(400)
      .json({
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

      // Block if child already attached
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

      // cycle protection (walk up parent chain, child should not appear)
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

      // 1) attach child at parent side + update direct counts
      parent[referralField] = child._id;
      parent[countField] = (parent[countField] || 0) + 1;

      // optional downline
      await User.updateOne(
        { _id: parent._id },
        { $addToSet: { downline: child._id } },
        { session }
      );

      // 2) set child's referredBy
      child.referredBy = parent._id;

      await Promise.all([parent.save({ session }), child.save({ session })]);

      // 3) update uplines leftCount/rightCount (as you already do)
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

      // ✅ 4) NOW LIKE REGISTER: recalc pairCount from ROOT + update ranks
      const rootId = await findRootId(parent._id, session); // or child._id
      if (rootId) {
        await recalcPairsDFS(rootId, session);
      }

      // ✅ 5) ensure child's rank too (optional; recalc already covers if in subtree)
      await upsertUserRankByPairCount(child._id, child.pairCount || 0, session);

      
    });

    return res.status(200).json({
      success: true,
      message: "User added to tree successfully (pairCount + rank updated)",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to add user to tree",
    });
  } finally {
    session.endSession();
  }
};


exports.getUserByIdDetails = async (req, res) => {
  // yaha pe downline, leftReferral, rightReferral sabko populate kar rahe hain
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      // virtual kyc
      .populate("kyc")
      // left user detail
      .populate({
        path: "leftReferral",
        select: "name email phone username referralCode status isActive leftCount rightCount",
      })
      // right user detail
      .populate({
        path: "rightReferral",
        select: "name email phone username referralCode status isActive leftCount rightCount",
      })
      // saari downline users
      .populate({
        path: "downline",
        select: "name email username referralCode status isActive leftCount rightCount",
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.updatePairCount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { pairCount } = req.body;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    // Validate pairCount
    if (typeof pairCount !== "number") {
      return res.status(400).json({
        success: false,
        message: "pairCount must be a number",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { pairCount } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "pairCount updated successfully",
      data: user,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};
