const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function normalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function cleanStr(v) {
  return String(v ?? "").trim();
}

function extractDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

// ✅ Unique referral code generator (e.g. OAG7K2P9Q)
async function generateReferralCode(prefix = "OAG") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoid O/0, I/1 confusion

  const makeCode = () => {
    let s = prefix;
    for (let i = 0; i < 8; i++)
      s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };

  let code = makeCode();
  while (await User.exists({ referralCode: code })) {
    code = makeCode();
  }
  return code;
}

// ✅ If phone missing, try digits from email, else generate unique random 10-digit
async function ensurePhone(phone, email) {
  let p = extractDigits(phone);

  if (!p) {
    // try from email (your emails have numbers like 7056046000 etc.)
    const fromEmail = extractDigits(email);
    if (fromEmail.length >= 10) p = fromEmail.slice(-10);
  }

  // still empty => generate random unique 10-digit
  while (!p || p.length < 10) {
    const random10 = String(
      Math.floor(1000000000 + Math.random() * 9000000000)
    );
    const exists = await User.exists({ phone: random10 });
    if (!exists) {
      p = random10;
      break;
    }
  }

  return p;
}

// ✅ Username only from phone (as you asked earlier)
async function generateUsernameFromPhone(phone) {
  const digits = extractDigits(phone);
  const base = "u" + digits.slice(-4); // u1234
  let username = base;
  let counter = 1;

  while (await User.exists({ username })) {
    username = base + counter; // u12341, u12342...
    counter++;
  }
  return username;
}

const uploadExcel = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "File", maxCount: 1 },
]);

router.post(
  "/import-excel",
  (req, res, next) => {
    uploadExcel(req, res, function (err) {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ message: err.message });
        }
        return res
          .status(500)
          .json({ message: "Upload failed", error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const uploaded =
        (req.files?.file && req.files.file[0]) ||
        (req.files?.File && req.files.File[0]);

      if (!uploaded) {
        return res.status(400).json({
          message: "Excel file required. Send form-data key: file (or File)",
        });
      }

      const workbook = XLSX.read(uploaded.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName)
        return res.status(400).json({ message: "No sheet found in file" });

      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!rawRows.length) {
        return res.status(400).json({ message: "Excel sheet is empty" });
      }

      // Map rows with flexible headers
      const mappedRows = rawRows.map((r, idx) => {
        const obj = {};
        for (const [k, v] of Object.entries(r)) obj[normalizeKey(k)] = v;

        return {
          rowNumber: idx + 2,
          name: cleanStr(obj.name || obj.fullname),
          email: cleanStr(obj.email || obj.mail).toLowerCase(),
          phone: cleanStr(
            obj.phone ||
              obj.phoneno ||
              obj.mobile ||
              obj.mobileno ||
              obj.contactno
          ),
          password: cleanStr(obj.password || obj.pass || obj.pwd),
        };
      });

      const invalid = [];
      const valid = [];

      for (const r of mappedRows) {
        if (!r.name || !r.email || !r.password) {
          invalid.push({
            row: r.rowNumber,
            reason: "Missing name/email/password",
          });
          continue;
        }
        if (!/^\S+@\S+\.\S+$/.test(r.email)) {
          invalid.push({ row: r.rowNumber, reason: "Invalid email format" });
          continue;
        }

        // ✅ clean weird passwords like "########" or "12345600%"
        if (!r.password || r.password.includes("#")) r.password = "123456";
        r.password = r.password.replace(/\s+/g, "");

        valid.push(r);
      }

      if (!valid.length) {
        return res
          .status(400)
          .json({ message: "No valid rows found", invalid });
      }

      // Duplicate email check
      const emails = [...new Set(valid.map((v) => v.email))];
      const existingUsers = await User.find({ email: { $in: emails } }).select(
        "email"
      );
      const existingEmails = new Set(existingUsers.map((u) => u.email));

      let inserted = 0;
      const skipped = [];

      for (const v of valid) {
        if (existingEmails.has(v.email)) {
          skipped.push({
            row: v.rowNumber,
            reason: "Email already exists",
            email: v.email,
          });
          continue;
        }

        const finalPhone = await ensurePhone(v.phone, v.email);
        const username = await generateUsernameFromPhone(finalPhone);
        const referralCode = await generateReferralCode("OAG"); // ✅ auto referral code
        const hashedPassword = await bcrypt.hash(v.password, 10);

        await User.create({
          name: v.name,
          email: v.email,
          phone: finalPhone,
          password: hashedPassword,
          username,
          referralCode, // ✅ added
          role: "User",
          isActive: true,
        });

        inserted++;
      }

      return res.status(201).json({
        message: "Excel import completed",
        inserted,
        skipped,
        invalid,
      });
    } catch (error) {
      console.error("IMPORT ERROR:", error);
      return res.status(500).json({
        message: "Import failed",
        error: error.message,
      });
    }
  }
);

module.exports = router;
