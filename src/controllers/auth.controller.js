const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const mongoose = require("mongoose");
const { validationResult } = require("express-validator");
const generateReferralCode = require('../utils/generateReferralCode');
// Register User with role
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const resetPasswordTemplate = require("../utils/resetPasswordTemplate");

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // 🔍 Check user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 🔐 Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // 💾 Save token
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // 🔗 URL
    const resetUrl = `https://oldasgold.com/reset-password/${resetToken}`;

    const html = resetPasswordTemplate({
      name: user.name,
      resetUrl,
    });

    // 🔥 IMPORTANT: await email (no background)
    await sendEmail({
      to: user.email,
      subject: "Reset Password",
      text: `Reset password: ${resetUrl}`,
      html,
    });

    // ✅ Only success if email sent
    res.status(200).json({
      success: true,
      message: "Reset link sent to email",
    });

  } catch (err) {
    console.error("❌ Forgot Password Error:", err);

    res.status(500).json({
      success: false,
      message: "Email not sent / Server error",
      error: err.message,
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Token invalid or expired",
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.json({ success: true, message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check existing admin by email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin only
    const admin = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "Admin", // 🔥 force Admin
    });

    res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Check admin with role = "Admin"
    const admin = await User.findOne({ email });

    if (!admin || admin.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    // 2️⃣ Password match
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 3️⃣ Generate JWT
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 4️⃣ Success response
    res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.registerUser = async (req, res) => {
  const { name, email, password, phone, role, referralCode } = req.body;

  const userRole = role || 'User'; // Default to 'User' if role is not specified

  try {
    // Check if the user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: "User already exists" });
    }

    // Generate the referral code for the new user
    const newReferralCode = await generateReferralCode(req.body.username || email);  // You can generate using username or email

    // Initialize referredBy as null
    let referredBy = null;

    // If a referral code is provided, validate it
    if (referralCode) {
      const referringUser = await User.findOne({ referralCode });

      // Check if the referring user exists
      if (referringUser) {
        referredBy = referringUser._id; // Link the new user to the referring user

        // Add the new user to the referring user's downline
        // referringUser.downline.push(user._id); // Push the new user's ID into the downline array
        await referringUser.save();  // Save the referring user's updated downline
      } else {
        // If the referral code is invalid (referring user not found), return an error
        return res.status(400).json({ msg: "Invalid referral code" });
      }
    }

    // Create the new user object
    user = new User({
      name,
      email,
      phone,
      password,
      role: userRole,
      referralCode: newReferralCode,  // Assign the generated referral code
      referredBy,  // Set the referring user (referredBy)
    });

    // Hash the user's password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save the user to the database
    await user.save();

    // If the user was referred, update the referring user's downline count
    if (referredBy) {
      const referringUser = await User.findById(referredBy);
      referringUser.downlineCount += 1; // Increment the downline count
      await referringUser.save();
    }

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
      },
    };

    // Sign the token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.status(200).json({
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            username: user.username,
            role: user.role,
          },
        });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};


// User Login
exports.loginUser = async (req, res) => {
  const { email, username, password } = req.body;

  try {
    // Check if either email or username is provided
    let user;
    if (email) {
      // If email is provided, find the user by email
      user = await User.findOne({ email });
    } else if (username) {
      // If username is provided, find the user by username
      user = await User.findOne({ username });
    } else {
      // If neither email nor username is provided, return an error
      return res.status(400).json({ msg: "Please provide either email or username" });
    }

    // If user not found, return an error
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // Compare password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // Create payload for JWT, including the user's role
    const payload = {
      user: {
        id: user.id,
        role: user.role, // Include role in the JWT payload
      },
    };

    // Sign JWT and return it to the client
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
      (err, token) => {
        if (err) throw err;
        res.status(200).json({
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            username: user.username,
            role: user.role,
          },
          token,
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};


const countSubtreeUsers = async (userId, session) => {
  if (!userId) return 0;

  const user = await User.findById(userId)
    .select("_id leftReferral rightReferral")
    .session(session);

  if (!user) return 0;

  const leftCount = user.leftReferral
    ? await countSubtreeUsers(user.leftReferral, session)
    : 0;

  const rightCount = user.rightReferral
    ? await countSubtreeUsers(user.rightReferral, session)
    : 0;

  return 1 + leftCount + rightCount;
};

/**
 * Recalculate one user's leftCount and rightCount
 */
const recalculateUserCounts = async (userId, session) => {
  const user = await User.findById(userId).session(session);
  if (!user) return;

  user.leftCount = user.leftReferral
    ? await countSubtreeUsers(user.leftReferral, session)
    : 0;

  user.rightCount = user.rightReferral
    ? await countSubtreeUsers(user.rightReferral, session)
    : 0;

  await user.save({ session });
};

/**
 * Find parent of child
 */
const findParent = async (childId, session) => {
  return await User.findOne({
    $or: [{ leftReferral: childId }, { rightReferral: childId }],
  }).session(session);
};

/**
 * Recalculate counts for this node and all its ancestors
 */
const updateCountsUpward = async (startUserId, session) => {
  let currentId = startUserId;

  while (currentId) {
    await recalculateUserCounts(currentId, session);

    const parent = await findParent(currentId, session);
    currentId = parent ? parent._id : null;
  }
};

/**
 * Get extreme left-most node in a subtree
 */
const findExtremeLeftNode = async (userId, session) => {
  let current = await User.findById(userId).session(session);
  if (!current) return null;

  while (current.leftReferral) {
    current = await User.findById(current.leftReferral).session(session);
    if (!current) break;
  }

  return current;
};

/**
 * Get extreme right-most node in a subtree
 */
const findExtremeRightNode = async (userId, session) => {
  let current = await User.findById(userId).session(session);
  if (!current) return null;

  while (current.rightReferral) {
    current = await User.findById(current.rightReferral).session(session);
    if (!current) break;
  }

  return current;
};

/**
 * Remove deleted user from all downlines
 */
const removeFromAllDownlines = async (userId, session) => {
  await User.updateMany(
    { downline: userId },
    { $pull: { downline: userId } },
    { session }
  );
};

/**
 * Nullify referredBy where needed
 */
const cleanupReferredBy = async (userId, session) => {
  await User.updateMany(
    { referredBy: userId },
    { $set: { referredBy: null } },
    { session }
  );
};

/**
 * Delete user and shift child upward
 *
 * Rules:
 * - no child: just detach
 * - one child: promote that child
 * - two children:
 *     promote right child
 *     attach left subtree to promoted node's extreme-left
 */
exports.deleteUserById = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    await session.startTransaction();

    const user = await User.findById(userId).session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const parent = await findParent(user._id, session);

    const isLeftChild =
      parent &&
      parent.leftReferral &&
      parent.leftReferral.toString() === user._id.toString();

    const isRightChild =
      parent &&
      parent.rightReferral &&
      parent.rightReferral.toString() === user._id.toString();

    const leftChildId = user.leftReferral ? user.leftReferral.toString() : null;
    const rightChildId = user.rightReferral ? user.rightReferral.toString() : null;

    let replacementId = null;

    /**
     * CASE 1: no child
     */
    if (!leftChildId && !rightChildId) {
      if (parent) {
        if (isLeftChild) parent.leftReferral = null;
        if (isRightChild) parent.rightReferral = null;
        await parent.save({ session });
      }
    }

    /**
     * CASE 2: only one child
     */
    else if (leftChildId && !rightChildId) {
      replacementId = leftChildId;

      if (parent) {
        if (isLeftChild) parent.leftReferral = replacementId;
        if (isRightChild) parent.rightReferral = replacementId;
        await parent.save({ session });
      }
    } else if (!leftChildId && rightChildId) {
      replacementId = rightChildId;

      if (parent) {
        if (isLeftChild) parent.leftReferral = replacementId;
        if (isRightChild) parent.rightReferral = replacementId;
        await parent.save({ session });
      }
    }

    /**
     * CASE 3: two children
     * promote right child
     * attach left subtree under promoted node's extreme-left
     */
    else if (leftChildId && rightChildId) {
      replacementId = rightChildId;

      // parent -> replacement
      if (parent) {
        if (isLeftChild) parent.leftReferral = replacementId;
        if (isRightChild) parent.rightReferral = replacementId;
        await parent.save({ session });
      }

      // replacement subtree ke sabse left node me deleted user ka left subtree attach karo
      const extremeLeftNode = await findExtremeLeftNode(replacementId, session);

      if (!extremeLeftNode) {
        throw new Error("Replacement node not found while restructuring tree");
      }

      if (!extremeLeftNode.leftReferral) {
        extremeLeftNode.leftReferral = leftChildId;
        await extremeLeftNode.save({ session });
      } else {
        throw new Error("Extreme left node already has left child, tree shift failed");
      }
    }

    // children ke referredBy ko clean karna ya update karna
    // yahan better hai null kar dein, kyunki actual referral relation business-based hota hai
    await cleanupReferredBy(user._id, session);

    // downline remove
    await removeFromAllDownlines(user._id, session);

    // optional:
    // deleted user ka id kisi aur ke left/right me stray form me ho to null karo
    await User.updateMany(
      { leftReferral: user._id },
      { $set: { leftReferral: null } },
      { session }
    );

    await User.updateMany(
      { rightReferral: user._id },
      { $set: { rightReferral: null } },
      { session }
    );

    // delete target user
    await User.deleteOne({ _id: user._id }, { session });

    // affected nodes recount
    if (replacementId) {
      await updateCountsUpward(replacementId, session);
    }

    if (parent) {
      await updateCountsUpward(parent._id, session);
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "User deleted successfully and tree restructured",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("DELETE USER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};
