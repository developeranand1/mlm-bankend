

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: false, unique: true },

    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["User", "Admin"], // request me "Admin" bhejna
      default: "User",
    },

    referralCode: { type: String, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Binary tree pointers
    leftReferral: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rightReferral: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Counts for pair logic
    leftCount: { type: Number, default: 0 },
    rightCount: { type: Number, default: 0 },
    pairPaid: { type: Number, default: 0 },
    pairCount:{type:Number, default:0},

    downline: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

// Auto username generator (same as yours)
UserSchema.pre("save", async function () {
  const user = this;
  if (!user.username) {
    let generated = user.name.split(" ")[0] + Math.floor(Math.random() * 1000);
    let exists = await mongoose.models.User.findOne({ username: generated });
    while (exists) {
      generated = user.name.split(" ")[0] + Math.floor(Math.random() * 1000);
      exists = await mongoose.models.User.findOne({ username: generated });
    }
    user.username = generated;
  }
});

module.exports = mongoose.model("User", UserSchema);

