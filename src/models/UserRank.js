// src/models/UserRank.js
const mongoose = require("mongoose");

const UserRankSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },

    position: { type: Number, required: true },
    rankName: { type: String, required: true },

    // image wali requirement: "pairs per side" (1+1, 3+3 etc)
    requiredPairsPerSide: { type: Number, required: true },

    bonusCash: { type: Number, default: 0 }, // like 500, 1000 etc
    reward: { type: String, default: "" },   // like ANDROID PHONE, BIKE etc

    // snapshot jab update hua
    pairCountAtUpdate: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },

    bonusClaimed: { type: Boolean, default: false },
bonusClaimedAt: { type: Date, default: null },
bonusClaimedAmount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserRank", UserRankSchema);
