const transporter = require("../config/nodemailer");
const { EMAIL_FROM } = require("../config/config");

// Global Style Tokens from DESIGN.md
const COLORS = {
  primary: "#6B8E23",     // Olive Green
  secondary: "#D28C45",   // Amber
  dark: "#1A3D2B",        // Forest Green
  neutral: "#F6F4EF",     // Cream Background
  text: "#2D3436",
  white: "#FFFFFF"
};

const BASE_TEMPLATE = (content, title, preheader) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700&family=Inter:wght@400;500&display=swap');
    body { font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: ${COLORS.neutral}; margin: 0; padding: 0; color: ${COLORS.text}; }
    .container { max-width: 600px; margin: 40px auto; background-color: ${COLORS.white}; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
    .header { background-color: ${COLORS.dark}; padding: 40px; text-align: center; }
    .logo { font-family: 'Plus Jakarta Sans', sans-serif; color: ${COLORS.primary}; font-size: 28px; letter-spacing: -1px; margin: 0; }
    .body { padding: 50px 40px; line-height: 1.6; }
    .title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 24px; color: ${COLORS.dark}; margin-bottom: 20px; }
    .button { display: inline-block; padding: 14px 32px; background-color: ${COLORS.primary}; color: ${COLORS.white} !important; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; margin: 30px 0; transition: transform 0.2s; }
    .footer { padding: 30px; text-align: center; font-size: 12px; color: #95a5a6; border-top: 1px solid #f1f2f6; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden;">${preheader}</div>
  <div class="container">
    <div class="header">
      <h1 class="logo">RecipeNest</h1>
    </div>
    <div class="body">
      <h2 class="title">${title}</h2>
      ${content}
    </div>
    <div class="footer">
      <p>© 2026 RecipeNest. Handcrafted for food lovers.</p>
      <p>Kathmandu, Nepal</p>
    </div>
  </div>
</body>
</html>
`;

const canSend = () => {
  const isConfigured = Boolean(transporter && transporter.options && transporter.options.host);
  if (!isConfigured) {
    console.log("[Email Service] SMTP is not configured. Skipping email.");
  }
  return isConfigured;
};

const sendEmail = async ({ to, subject, html }) => {
  if (!canSend()) {
    return null;
  }
  
  try {
    console.log(`[Email Service] Attempting to send email to: ${to}...`);
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });
    console.log(`[Email Service] Email sent successfully! MessageId: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[Email Service] FAILED to send email to ${to}:`, error.message);
    return null;
  }
};

const sendWelcomeEmail = async (user) => {
  const content = `
    <p>Hi ${user.firstName || 'Chef'},</p>
    <p>Welcome to the family! We're so excited to have you join our community of culinary creators.</p>
    <p>Start exploring thousands of curated recipes or share your own masterpieces today.</p>
    <div style="text-align: center;">
      <a href="http://localhost:5173/dashboard" class="button">Go to My Dashboard</a>
    </div>
  `;
  return sendEmail({
    to: user.email,
    subject: "Welcome to RecipeNest 🍳",
    html: BASE_TEMPLATE(content, "Let's Get Cooking!", "Welcome to the elite community of chefs.")
  });
};

const sendVerificationEmail = async (user, token) => {
  const content = `
    <p>To keep your account secure, please verify your email address by clicking the button below:</p>
    <div style="text-align: center;">
      <a href="http://localhost:5173/verify-email/${token}" class="button">Verify Email Address</a>
    </div>
    <p style="font-size: 13px; color: #7f8c8d; text-align: center;">This link will expire in 24 hours.</p>
  `;
  return sendEmail({
    to: user.email,
    subject: "Verify your email - RecipeNest",
    html: BASE_TEMPLATE(content, "Confirm Your Identity", "Almost there! Just one click to verify.")
  });
};

const sendPasswordResetEmail = async (user, resetUrl) => {
  const content = `
    <p>We received a request to reset your password. If this was you, please click below:</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="button">Choose a New Password</a>
    </div>
    <p style="font-size: 13px; color: #7f8c8d; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
  `;
  return sendEmail({
    to: user.email,
    subject: "Reset your password - RecipeNest",
    html: BASE_TEMPLATE(content, "Forgot Something?", "Reset your password safely and quickly.")
  });
};

const sendModerationEmail = async (chef, action) => {
  const content = `
    <p>We have completed the moderation of your latest recipe submission.</p>
    <p>Status: <strong style="color: ${action === 'approved' ? COLORS.primary : '#e74c3c'}">${action.toUpperCase()}</strong></p>
    <p>Thank you for contributing to the quality of our platform.</p>
  `;
  return sendEmail({
    to: chef.contactEmail || chef.email,
    subject: "Recipe moderation update",
    html: BASE_TEMPLATE(content, "Moderation Update", "Your recipe has been reviewed.")
  });
};

module.exports = {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendModerationEmail,
};
