// routes/ticket.js
const express = require("express");
const router = express.Router();
const Ticket = require("../models/supportTicket"); 
const upload = require('../middlewares/ticket-Image.middleware')

router.post("/", upload.array("screenshots", 5), async (req, res) => {
  try {
    // In multer-storage-cloudinary, file.path is the secure URL
    const screenshotUrls = (req.files || []).map((file) => file.path);

    const ticket = await Ticket.create({
      userId: req.body.userId,
      userType: req.body.userType,
      category: req.body.category,
      priority: req.body.priority,
      subject: req.body.subject,
      description: req.body.description,
      screenshots: screenshotUrls,
      status: "Open",
      replies: [{ by: "USER", message: req.body.description }],
      lastRepliedAt: new Date(),
    });

    res.status(201).json({ success: true, ticket });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ✅ Admin: all tickets (keep above /:id)
router.get("/admin/all", async (req, res) => {
  const tickets = await Ticket.find().populate("userId", "name email") .sort({ createdAt: -1 });
  res.json({ success: true, tickets });
});

// ✅ Get tickets by userId (keep above /:id)
router.get("/user/:userId", async (req, res) => {
  const tickets = await Ticket.find({ userId: req.params.userId }).sort({ createdAt: -1 });
  res.json({ success: true, tickets });
});

// ✅ Get ticket by ticketId
router.get("/:id", async (req, res) => {
  const ticket = await Ticket.findById(req.params.id).populate("userId", "name email") ;
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
  res.json({ success: true, ticket });
});

// ✅ Reply (USER/ADMIN) - id based, no auth
router.post("/:id/reply", async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

  ticket.replies.push({
    by: req.body.by || "USER", // USER / ADMIN
    message: req.body.message,
  });

  if (req.body.status) ticket.status = req.body.status; // Open/In Progress/Resolved
  ticket.lastRepliedAt = new Date();

  await ticket.save();
  res.json({ success: true, ticket });
});


// ✅ Close Ticket API
router.patch("/:id/close", async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

    ticket.status = "Resolved";
    ticket.lastRepliedAt = new Date();
    await ticket.save();

    res.json({ success: true, ticket });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});



module.exports = router;
