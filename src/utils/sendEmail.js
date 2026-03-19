// const nodemailer = require("nodemailer");

// const sendEmail = async ({ to, subject, html, text }) => {
//   const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: Number(process.env.SMTP_PORT),
//     secure: false, // true only for 465
//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS,
//     },
//   });

//   const info = await transporter.sendMail({
//     from: process.env.FROM_EMAIL,
//     to,
//     subject,
//     text,
//     html,
//   });

//   return info;
// };

// module.exports = sendEmail;


const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to,
    subject,
    text,
    html,
  });

  console.log("✅ Email sent:", info.messageId);

  return info;
};

module.exports = sendEmail;