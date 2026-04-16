const transporter = require("../config/nodemailer");
const { EMAIL_FROM } = require("../config/config");

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

const sendWelcomeEmail = async (user) =>
  sendEmail({
    to: user.email,
    subject: "Welcome to RecipeNest 🍳",
    html: `
      <h2>Thank you for joining RecipeNest, ${user.firstName}!</h2>
      <p>Your account has been created successfully.</p>
      <p>We're thrilled to have you in our community of food lovers and creators. You can now start browsing recipes, following your favorite chefs, and sharing your own culinary masterpieces.</p>
      <br>
      <div style="text-align: center; margin: 30px 0;">
        <a href="http://localhost:3000/dashboard" style="padding: 12px 24px; background-color: #1A3D2B; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Go to Dashboard</a>
      </div>
      <br>
      <p>Happy Cooking,<br>The RecipeNest Team</p>
    `,
  });

const sendVerificationEmail = async (user, token) =>
  sendEmail({
    to: user.email,
    subject: "Verify your email - RecipeNest",
    html: `
      <h3>Verify your email address</h3>
      <p>Thank you for signing up! Please verify your email by clicking the link below:</p>
      <a href="http://localhost:3000/verify-email/${token}" style="padding: 10px 20px; background-color: #E8760A; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `,
  });

const sendPasswordResetEmail = async (user, resetUrl) =>
  sendEmail({
    to: user.email,
    subject: "Reset your password - RecipeNest",
    html: `
      <h3>Password Reset Request</h3>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <a href="${resetUrl}" style="padding: 10px 20px; background-color: #1A3D2B; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request a password reset, please ignore this email.</p>
    `,
  });

const sendModerationEmail = async (chef, action) =>
  sendEmail({
    to: chef.contactEmail,
    subject: "Recipe moderation update",
    html: `<p>Your content moderation result: ${action}</p>`,
  });

module.exports = {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendModerationEmail,
};
