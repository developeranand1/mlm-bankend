

// const nodemailer = require("nodemailer");

// const sendEmail = async ({ to, subject, text, html }) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: Number(process.env.SMTP_PORT),
//       secure: false, // ✅ 465 ke liye true
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//       connectionTimeout: 10000,
//     });

//     const info = await transporter.sendMail({
//       from: `"OldAsGold" <${process.env.FROM_EMAIL}>`,
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
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // ✅ 587 ke liye false
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });

    // ✅ SMTP connection check
    await transporter.verify();
    console.log("✅ SMTP Connected");

    const info = await transporter.sendMail({
      from: `"OldAsGold" <${process.env.SMTP_USER}>`, // better use same email
      to,
      subject,
      text,
      html,
    });

    console.log("✅ Email sent:", info.messageId);
    return info;

  } catch (error) {
    console.error("❌ Email error:", error);
    throw error;
  }
};

module.exports = sendEmail;