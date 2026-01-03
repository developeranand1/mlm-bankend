const User = require("../models/User");
const Kyc = require("../models/Kyc");
const Wallet = require("../models/Wallet");
const WithdrawalRequest = require("../models/WithdrawalRequest");
const Order = require("../models/Order");
const Product = require("../models/Product");

function toMap(groupArr, keyField = "_id", valField = "count") {
  const out = {};
  for (const g of groupArr || []) out[String(g[keyField])] = g[valField];
  return out;
}

exports.getAdminDashboardStats = async (req, res) => {
  try {
    const [
      // USERS
      usersTotal,
      usersActive,
      usersInactive,
      adminsTotal,

      // KYC
      kycTotal,
      kycByStatus,

      // WITHDRAWALS
      withdrawalsTotal,
      withdrawalsByStatus,
      withdrawalsAmountByStatus,

      // WALLETS
      walletsAgg,

      // ORDERS
      ordersTotal,
      ordersByStatus,
      ordersPaidAmount,

      // PRODUCTS
      productsTotal,
      productsInStock,
      productsOutOfStock,
    ] = await Promise.all([
      // USERS
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ role: "Admin" }),

      // KYC
      Kyc.countDocuments({}),
      Kyc.aggregate([
        { $group: { _id: { $toLower: "$status" }, count: { $sum: 1 } } },
      ]),

      // WITHDRAWALS
      WithdrawalRequest.countDocuments({}),
      WithdrawalRequest.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      WithdrawalRequest.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),

      // WALLETS totals
      Wallet.aggregate([
        {
          $group: {
            _id: null,
            wallets: { $sum: 1 },
            totalBalance: { $sum: "$balance" },
            totalLocked: { $sum: "$locked" },
          },
        },
      ]),

      // ORDERS
      Order.countDocuments({}),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { status: "PAID" } },
        { $group: { _id: null, totalSales: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),

      // PRODUCTS
      Product.countDocuments({}),
      Product.countDocuments({ stock: { $gt: 0 } }),
      Product.countDocuments({ stock: { $lte: 0 } }),
    ]);

    const kycStatusMap = toMap(kycByStatus);
    const withdrawalsStatusMap = toMap(withdrawalsByStatus);
    const withdrawalsAmountMap = {};
    for (const row of withdrawalsAmountByStatus || []) {
      withdrawalsAmountMap[String(row._id)] = {
        count: row.count,
        totalAmount: row.totalAmount,
      };
    }

    const walletRow = walletsAgg?.[0] || { wallets: 0, totalBalance: 0, totalLocked: 0 };
    const ordersPaidRow = ordersPaidAmount?.[0] || { totalSales: 0, count: 0 };

    // ✅ "payments" summary (as you asked)
    // Here payments = PAID orders count + Paid withdrawals count (you can change logic)
    const paidOrdersCount = ordersPaidRow.count || 0;
    const paidWithdrawalsCount = withdrawalsStatusMap["Paid"] || 0;

    return res.json({
      ok: true,
      stats: {
        users: {
          total: usersTotal,
          active: usersActive,
          inactive: usersInactive,
          admins: adminsTotal,
        },

        kyc: {
          total: kycTotal,
          byStatus: kycStatusMap, // e.g. { pending: 10, approved: 5, rejected: 2 }
        },

        withdrawals: {
          total: withdrawalsTotal,
          byStatus: withdrawalsStatusMap, // e.g. { Requested: 3, Paid: 10, Cancelled: 2 }
          amountByStatus: withdrawalsAmountMap, // status-wise sum(amount)
        },

        wallets: {
          totalWallets: walletRow.wallets,
          totalBalance: walletRow.totalBalance,
          totalLocked: walletRow.totalLocked,
        },

        orders: {
          total: ordersTotal,
          byStatus: toMap(ordersByStatus),
          paid: {
            count: ordersPaidRow.count,
            totalSales: ordersPaidRow.totalSales,
          },
        },

        products: {
          total: productsTotal,
          inStock: productsInStock,
          outOfStock: productsOutOfStock,
        },

        payments: {
          paidOrdersCount,
          paidWithdrawalsCount,
          totalPaidEvents: paidOrdersCount + paidWithdrawalsCount,
        },
      },
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error while generating dashboard stats",
    });
  }
};
