
function getPairStatus(user) {
  const left = Number(user.leftCount || 0);
  const right = Number(user.rightCount || 0);
  const pairPaid = Boolean(user.pairPaid);


  const pairs = Math.min(left, right);

  return {
    left,
    right,
    pairs,
    pairPaid,
    isEligible: pairs > 0,
  };
}

module.exports = { getPairStatus };

