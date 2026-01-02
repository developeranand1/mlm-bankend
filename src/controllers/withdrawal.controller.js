const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const Withdrawal = require("../models/WithdrawalRequest");
const User = require("../models/User");


exports.createWithdrawal = async (req, res) => {
  const userId = req.user._id; // from auth middleware
  const { amount } = req.body;

  if (!amount || amount < 1) return res.status(400).json({ ok:false, message:"Invalid amount" });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const wallet = await Wallet.findOne({ user: userId }).session(session);
      if (!wallet) throw new Error("Wallet not found");

      if (wallet.balance < amount) throw new Error("Insufficient balance");

      // get user KYC snapshot
      const user = await User.findById(userId).populate("kyc").session(session);
      if (!user?.kyc) throw new Error("KYC not found");

      // (optional) allow only if KYC Approved
      // if (user.kyc.status !== "Approved") throw new Error("KYC not approved");

      // lock funds
      wallet.balance -= amount;
      wallet.locked += amount;
      await wallet.save({ session });

      const wd = await Withdrawal.create([{
        user: userId,
        amount,
        status: "Requested",
        bank: {
          accountHolderName: user.kyc.accountHolderName,
          bankAccountNumber: user.kyc.bankAccountNumber,
          bankName: user.kyc.bankName,
          ifscCode: user.kyc.ifscCode,
          upiId: user.kyc.upiId,
        }
      }], { session });

      res.json({ ok:true, message:"Withdrawal requested", withdrawal: wd[0] });
    });
  } catch (e) {
    res.status(400).json({ ok:false, message: e.message });
  } finally {
    session.endSession();
  }
};


exports.myWithdrawals = async (req, res) => {
  const userId = req.user._id;
  const list = await Withdrawal.find({ user: userId }).sort({ createdAt: -1 });
  res.json({ ok:true, count: list.length, withdrawals: list });
};


exports.cancelWithdrawal = async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const wd = await Withdrawal.findOne({ _id: id, user: userId }).session(session);
      if (!wd) throw new Error("Not found");
      if (wd.status !== "Requested") throw new Error("Cannot cancel now");

      const wallet = await Wallet.findOne({ user: userId }).session(session);
      if (!wallet) throw new Error("Wallet not found");

      // refund
      wallet.locked -= wd.amount;
      wallet.balance += wd.amount;
      await wallet.save({ session });

      wd.status = "Cancelled";
      await wd.save({ session });

      res.json({ ok:true, message:"Cancelled & refunded", withdrawal: wd });
    });
  } catch (e) {
    res.status(400).json({ ok:false, message: e.message });
  } finally {
    session.endSession();
  }
};


exports.adminListWithdrawals = async (req, res) => {
  const { status, page=1, limit=50 } = req.query;
  const q = {};
  if (status) q.status = status;

  const items = await Withdrawal.find(q)
    .populate("user", "name email phone username")
    .sort({ createdAt: -1 })
    .skip((page-1)*limit)
    .limit(Number(limit));

  const count = await Withdrawal.countDocuments(q);
  res.json({ ok:true, count, withdrawals: items });
};

exports.approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;

    const wd = await Withdrawal.findById(id);
    if (!wd) {
      return res.status(404).json({ ok: false, message: "Withdrawal not found" });
    }

    if (wd.status !== "Requested") {
      return res.status(400).json({ ok: false, message: "Invalid status" });
    }

    wd.status = "Approved";
    wd.adminNote = adminNote || "Approved without token";
    wd.approvedAt = new Date();

    await wd.save();

    res.json({
      ok: true,
      message: "Approved",
      withdrawal: wd
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
};


exports.rejectWithdrawal = async (req, res) => {
  const { id } = req.params;
  const { adminNote } = req.body;

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const wd = await Withdrawal.findById(id).session(session);
      if (!wd) throw new Error("Not found");

      if (!["Requested", "Approved", "Processing"].includes(wd.status)) {
        throw new Error("Cannot reject now");
      }

      const wallet = await Wallet.findOne({ user: wd.user }).session(session);
      if (!wallet) throw new Error("Wallet not found");

      // refund locked -> balance
      if (wallet.locked < wd.amount) throw new Error("Wallet locked mismatch");

      wallet.locked -= wd.amount;
      wallet.balance += wd.amount;
      await wallet.save({ session });

      wd.status = "Rejected";
      wd.adminNote = adminNote || "Rejected";
      wd.rejectedAt = new Date();

      await wd.save({ session });

      res.json({ ok: true, message: "Rejected & refunded", withdrawal: wd });
    });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  } finally {
    await session.endSession();
  }
};

exports.markProcessing = async (req, res) => {
  const { id } = req.params;
  const wd = await Withdrawal.findById(id);
  if (!wd) return res.status(404).json({ ok:false, message:"Not found" });
  if (wd.status !== "Approved") return res.status(400).json({ ok:false, message:"Only Approved can go Processing" });

  wd.status = "Processing";
  wd.processedAt = new Date();
  await wd.save();
  res.json({ ok:true, message:"Marked Processing", withdrawal: wd });
};

exports.exportWithdrawalsCSV = async (req, res) => {
  const { status = "Approved" } = req.query;

  const rows = await Withdrawal.find({ status })
    .populate("user", "name email phone username")
    .sort({ createdAt: 1 });

  const header = [
    "withdrawalId","createdAt","userId","username","name","phone","email",
    "amount","accountHolderName","bankAccountNumber","bankName","ifscCode","upiId","status"
  ];

  const csv = [
    header.join(","),
    ...rows.map(r => ([
      r._id, r.createdAt?.toISOString(),
      r.user?._id, r.user?.username, r.user?.name, r.user?.phone, r.user?.email,
      r.amount,
      r.bank?.accountHolderName, r.bank?.bankAccountNumber, r.bank?.bankName, r.bank?.ifscCode, r.bank?.upiId,
      r.status
    ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")))
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="withdrawals_${status}.csv"`);
  res.send(csv);
};

exports.markPaidWithProof = async (req, res) => {
  const adminId = req.admin?._id;
  const { id } = req.params;
  const { utr, mode, paidAt, proofUrl, proofNote } = req.body;

  // ✅ Cloudinary returns full URL here
  const cloudinaryUrl = req.file?.path;          // e.g. https://res.cloudinary.com/.../image/upload/...
  // some setups also provide secure_url, keep fallback:
  const finalProofUrl = proofUrl || cloudinaryUrl;

  if (!finalProofUrl) {
    return res.status(400).json({ ok: false, message: "Proof image or proofUrl is required" });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const wd = await Withdrawal.findById(id).session(session);
      if (!wd) throw new Error("Not found");
      if (!["Approved", "Processing"].includes(wd.status)) {
        throw new Error("Only Approved/Processing can be Paid");
      }

      const wallet = await Wallet.findOne({ user: wd.user }).session(session);
      if (!wallet) throw new Error("Wallet not found");
      if (wallet.locked < wd.amount) throw new Error("Wallet locked mismatch");

      wallet.locked -= wd.amount;
      await wallet.save({ session });

      wd.status = "Paid";
      wd.proof = {
        utr,
        mode,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        proofUrl: finalProofUrl,       // ✅ SAVE FULL URL
        proofNote,
        uploadedBy: adminId,
        uploadedAt: new Date(),
      };

      await wd.save({ session });
      res.json({ ok: true, message: "Marked Paid + proof saved", withdrawal: wd });
    });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  } finally {
    session.endSession();
  }
};



