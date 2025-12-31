const express = require("express");
const ContactMessage = require("../models/ContactMessage");

const router = express.Router();

/**
 * POST /api/contact
 * body: { name, email, phone, service, message }
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, service, message } = req.body || {};

    // validation
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
    if (!emailOk) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const doc = await ContactMessage.create({
      name: name.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : "",
      service: service ? service.trim() : "",
      message: message.trim(),
    });

    return res.status(201).json({
      message: "Message submitted successfully",
      data: { id: doc._id },
    });
  } catch (err) {
    console.error("Contact POST error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/contact
 * Optional query: ?status=new&page=1&limit=20
 */
router.get("/", async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      ContactMessage.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      ContactMessage.countDocuments(query),
    ]);

    return res.json({
      page: pageNum,
      limit: limitNum,
      total,
      items,
    });
  } catch (err) {
    console.error("Contact GET error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
