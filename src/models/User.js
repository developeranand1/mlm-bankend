const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: false, // Allow username to be empty initially
    unique: true,
  },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['User', 'Admin'],
    default: 'User',
  },
  kyc: { type: mongoose.Schema.Types.ObjectId, ref: "Kyc" },
}, {timestamps: true});

// Pre-save hook to generate username automatically if it's not provided
UserSchema.pre('save', async function () {
  const user = this; // 'this' refers to the current document being saved

  if (!user.username) {
    // Generate username from name and email or any other logic
    let generatedUsername = user.name.split(' ')[0] + Math.floor(Math.random() * 1000);
    
    // Ensure the username is unique
    let usernameExists = await mongoose.models.User.findOne({ username: generatedUsername });
    while (usernameExists) {
      // If username exists, append a new random number
      const randomSuffix = Math.floor(Math.random() * 1000);
      generatedUsername = user.name.split(' ')[0] + randomSuffix;
      usernameExists = await mongoose.models.User.findOne({ username: generatedUsername });
    }

    // Assign the generated username to this document
    user.username = generatedUsername;
  }

  // No need to call next() in async function, Mongoose will handle it automatically
});

module.exports = mongoose.model("User", UserSchema);
