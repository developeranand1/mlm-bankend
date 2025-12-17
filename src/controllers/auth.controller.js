const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { validationResult } = require("express-validator");

// Register User with role
exports.registerUser = async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  // You can specify role here, default will be 'User' if not provided
  const userRole = role || "User";

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: "User already exists" });
    }

    user = new User({
      name,
      email,
      phone,
      password,
      role: userRole, // Assign the role (either 'User' or 'Admin')
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
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
  const { email, password } = req.body;

  try {
    // Find user by email
    let user = await User.findOne({ email });
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
