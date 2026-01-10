// Image wali rank table (X + X)
const RANKS = [
  { position: 1, rankName: "Achiever", requiredPairsPerSide: 1, bonusCash: 500, reward: "" },
  { position: 2, rankName: "Golden Achiever", requiredPairsPerSide: 4, bonusCash: 1000, reward: "" },
  { position: 3, rankName: "Leader", requiredPairsPerSide: 11, bonusCash: 4000, reward: "" },
  { position: 4, rankName: "Star", requiredPairsPerSide: 26, bonusCash: 10000, reward: "Android Phone" },
  { position: 5, rankName: "Silver Star", requiredPairsPerSide: 61, bonusCash: 25000, reward: "Electric Scooty" },

  { position: 6, rankName: "Gold Star", requiredPairsPerSide: 131, bonusCash: 100000, reward: "Pulsar Bike" },
  { position: 7, rankName: "Platinum", requiredPairsPerSide: 251, bonusCash: 170000, reward: "Bullet Bike" },
  { position: 8, rankName: "Diamond", requiredPairsPerSide: 526, bonusCash: 330000, reward: "World Tour (Singapore) + 3L Cash" },
  { position: 9, rankName: "Great Player", requiredPairsPerSide: 1100, bonusCash: 450000, reward: "Alto Car" },
  { position: 10, rankName: "Big Dreamer", requiredPairsPerSide: 2200, bonusCash: 1000000, reward: "Tata Nexon" },

  { position: 11, rankName: "Big Boss", requiredPairsPerSide: 4400, bonusCash: 2100000, reward: "Thar + 10 Lakh" },
  { position: 12, rankName: "Legend", requiredPairsPerSide: 8800, bonusCash: 4100000, reward: "Fortuner Legender" },
  { position: 13, rankName: "Legendary Icon", requiredPairsPerSide: 17600, bonusCash: 7000000, reward: "Range Rover" },
  { position: 14, rankName: "National Leader", requiredPairsPerSide: 30000, bonusCash: 10000000, reward: "Villa" },
  { position: 15, rankName: "World Leader", requiredPairsPerSide: 43000, bonusCash: 20000000, reward: "Family Tour + 1Cr + Defender" },
];

// pairCount ke base pe best rank nikal do
function getRankByPairs(pairCount = 0) {
  let best = null;
  for (const r of RANKS) {
    if (pairCount >= r.requiredPairsPerSide) best = r;
  }
  return best; // null agar koi rank nahi
}

module.exports = { getRankByPairs, RANKS };
