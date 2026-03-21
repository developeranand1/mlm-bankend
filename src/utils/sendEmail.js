


// const nodemailer = require("nodemailer");

// const sendEmail = async ({ to, subject, text, html }) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       host: "smtp.gmail.com",
//       port: 587,
//       secure: false, // TLS
//       auth: {
//         user: "oldasgold25info@gmail.com",
//         pass: "bnpnlowxhqqqwojn", // app password
//       },
//       tls: {
//         rejectUnauthorized: false,
//       },
//     });

//     const info = await transporter.sendMail({
//       from: `"OldAsGold" <oldasgold25info@gmail.com>`,
//       to,
//       subject,
//       text,
//       html,
//     });

//     console.log("✅ Email sent:", info.messageId);
//     return info;

//   } catch (error) {
//     console.error("❌ Email error:", error);
//     throw error;
//   }
// };

// module.exports = sendEmail;


const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465, // ✅ change here
    secure: true, // ✅ must be true for 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
  });

  const info = await transporter.sendMail({
    from: `"OldAsGold" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });

  console.log("✅ Email sent:", info.messageId);
  return info;
};

module.exports = sendEmail;