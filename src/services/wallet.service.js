const Wallet = require("../models/Wallet");
const WalletTxn = require("../models/WalletTransaction");

async function getOrCreateWallet(userId, session) {
  let wallet = await Wallet.findOne({ userId }).session(session);
  if (!wallet) {
    const created = await Wallet.create([{ userId, balance: 0 }], { session });
    wallet = created[0];
  }
  return wallet;
}

async function creditWallet({ userId, amount, reason, referenceId, meta = {}, provider = "NONE", razorpay = {} }, session) {
  const wallet = await getOrCreateWallet(userId, session);

  const opening = wallet.balance;
  wallet.balance += amount;

  await wallet.save({ session });

  await WalletTxn.create(
    [{
      userId,
      type: "CREDIT",
      amount,
      reason,
      status: "SUCCESS",
      openingBalance: opening,
      closingBalance: wallet.balance,
      referenceId,
      provider,
      razorpayOrderId: razorpay.razorpayOrderId,
      razorpayPaymentId: razorpay.razorpayPaymentId,
      razorpaySignature: razorpay.razorpaySignature,
      meta,
    }],
    { session }
  );
}

async function debitWallet({ userId, amount, reason, referenceId, meta = {} }, session) {
  const wallet = await getOrCreateWallet(userId, session);
  if (wallet.balance < amount) throw new Error("Insufficient balance");

  const opening = wallet.balance;
  wallet.balance -= amount;

  await wallet.save({ session });

  await WalletTxn.create(
    [{
      userId,
      type: "DEBIT",
      amount,
      reason,
      status: "SUCCESS",
      openingBalance: opening,
      closingBalance: wallet.balance,
      referenceId,
      meta,
    }],
    { session }
  );
}

module.exports = { getOrCreateWallet, creditWallet, debitWallet };
