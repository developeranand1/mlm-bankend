const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { validationResult } = require("express-validator");
const generateReferralCode = require('../utils/generateReferralCode');
// Register User with role

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
