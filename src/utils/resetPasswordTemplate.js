const resetPasswordTemplate = ({ name, resetUrl, appName = "Your App" }) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body { font-family: Arial, sans-serif; background:#f4f6f8; padding:20px; }
      .container { max-width:520px; margin:auto; background:#fff; padding:24px; border-radius:10px; }
      .btn { display:inline-block; padding:12px 18px; background:#2563eb; color:#fff !important;
             text-decoration:none; border-radius:6px; margin-top:12px; }
      .muted { color:#6b7280; font-size:12px; margin-top:18px; }
      .header { font-size:18px; font-weight:700; margin-bottom:8px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">Hello ${name} 👋</div>
      <p>You requested to reset your password.</p>
      <p>Click the button below to set a new password:</p>

      <a class="btn" href="${resetUrl}" target="_blank">Reset Password</a>

      <p class="muted">This link will expire in 15 minutes.</p>
      <p class="muted">If you didn't request this, you can ignore this email.</p>

      <p class="muted">— ${appName} Team</p>
    </div>
  </body>
  </html>
  `;
};

module.exports = resetPasswordTemplate;
