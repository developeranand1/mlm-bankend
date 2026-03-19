const nodemailer = require("nodemailer");



// SMTP_HOST=smtp.gmail.com
// SMTP_PORT=587
// SMTP_USER=oldasgold25info@gmail.com 
// SMTP_PASS=bnpnlowxhqqqwojn
// FROM_EMAIL=oldasgold25info@gmail.com

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: Number(587),
    secure: false, // true only for 465
    auth: {
      user: "oldasgold25info@gmail.com",
      pass:"bnpnlowxhqqqwojn",
    },
  });

  const info = await transporter.sendMail({
    from: "oldasgold25info@gmail.com",
    to,
    subject,
    text,
    html,
  });

  return info;
};

module.exports = sendEmail;
