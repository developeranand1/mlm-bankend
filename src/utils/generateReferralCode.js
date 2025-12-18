const crypto = require('crypto');
const User = require('../models/User'); // Ensure this path is correct

// Function to generate a unique referral code
const generateReferralCode = async (userId) => {
  // Generate a random alphanumeric string of length 7
  const randomString = crypto.randomBytes(4).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 7);

  // Combine the last 5 digits of the user ID with the random alphanumeric string
  let code = userId.toString().slice(-5) + randomString;

  // Ensure the referral code is unique by checking the database
  let existingUser = await User.findOne({ referralCode: code });

  while (existingUser) {
    // If the code exists, regenerate it with a new random alphanumeric string
    const newRandomString = crypto.randomBytes(4).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 7);
    code = userId.toString().slice(-5) + newRandomString;
    existingUser = await User.findOne({ referralCode: code });
  }

  return code;
};

// Export the function so it can be used in other files
module.exports = generateReferralCode;
