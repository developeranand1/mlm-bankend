const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
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

    // 💾 Save token in DB
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // 🔗 Reset URL
    const resetUrl = `https://oldasgold.com/reset-password/${resetToken}`;

    // 📧 Email template
    const html = resetPasswordTemplate({
      name: user.name,
      resetUrl,
      appName: "OldAsGold",
    });

    // ✅ 🔥 SEND RESPONSE FIRST (IMPORTANT)
    res.status(200).json({
      success: true,
      message: "Reset link sent to email",
    });

    // 🚀 Send email in background (no await)
    sendEmail({
      to: user.email,
      subject: "Reset Password",
      text: `Hello ${user.name}, reset your password using this link: ${resetUrl}`,
      html,
    }).catch((err) => {
      console.error("❌ Email sending failed:", err);
    });

  } catch (err) {
    console.error("❌ Forgot Password Error:", err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
// exports.forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;

//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     const resetToken = crypto.randomBytes(32).toString("hex");
//     const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

//     user.resetPasswordToken = hashedToken;
//     user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
//     await user.save({ validateBeforeSave: false });

//     const resetUrl = `https://oldasgold.com/reset-password/${resetToken}`;

//     // ✅ USE EMAIL TEMPLATE WITH USER NAME
//     const html = resetPasswordTemplate({
//       name: user.name,
//       resetUrl,
//       appName: "Your App Name",
//     });

//     await sendEmail({
//       to: user.email,
//       subject: "Reset Password",
//       text: `Hello ${user.name}, reset your password using this link: ${resetUrl}`,
//       html,
//     });

//     res.json({
//       success: true,
//       message: "Reset link sent to email",
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };


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

exports.deleteUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    // ✅ Validate ObjectId
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ❗ OPTIONAL: Prevent admin deletion
    // if (user.role === "Admin") {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Admin cannot be deleted",
    //   });
    // }

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// exports.adminLogin = async (req, res) => {
//   try {
//     const { email, password } = req.body;

 
//     const admin = await User.findOne({ email, role: "Admin" });
//     if (!admin) {
//       return res.status(401).json({
//         success: false,
//         message: "Admin not found or access denied",
//       });
//     }

//     // Password check
//     const isMatch = await bcrypt.compare(password, admin.password);
//     if (!isMatch) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials",
//       });
//     }

//     // JWT Token
//     const token = jwt.sign(
//       { id: admin._id, role: admin.role },
//       process.env.JWT_SECRET,
//       { expiresIn: "1d" }
//     );

//     res.status(200).json({
//       success: true,
//       message: "Admin login successful",
//       token,
//       user: {
//         id: admin._id,
//         name: admin.name,
//         email: admin.email,
//         role: admin.role,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

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
