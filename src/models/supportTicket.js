// models/supportTicket.js
const mongoose = require("mongoose");

const supportTicketSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userType: { type: String, enum: ["USER"], required: true },

    category: { type: String, required: true }, // Academic / Technical / Marketing
    priority: { type: String, enum: ["Low", "Medium", "High"], default: "Low" },

    subject: { type: String, required: true },
    description: { type: String, required: true },

    screenshots: [{ type: String }], // S3 URL

    status: { type: String, enum: ["Open", "In Progress", "Resolved"], default: "Open" },

    replies: [
      {
        by: { type: String, enum: ["USER", "ADMIN"], required: true },
        message: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],

    lastRepliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);


supportTicketSchema.pre("save", async function () {
  
});

module.exports =
  mongoose.models.SupportTicket || mongoose.model("SupportTicket", supportTicketSchema);
