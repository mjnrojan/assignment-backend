const transporter = require("../config/nodemailer");
const { EMAIL_FROM } = require("../config/config");

const canSend = () => Boolean(transporter && transporter.options && transporter.options.host);

const sendEmail = async ({ to, subject, html }) => {
  if (!canSend()) {
    return null;
  }
  return transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });
};

const sendWelcomeEmail = async (user) =>
  sendEmail({
    to: user.email,
    subject: "Welcome to RecipeNest",
    html: `<p>Hello ${user.firstName}, welcome to RecipeNest.</p>`,
  });

const sendVerificationEmail = async (user, token) =>
  sendEmail({
    to: user.email,
    subject: "Verify your email",
    html: `<p>Use this token to verify your email: ${token}</p>`,
  });

const sendPasswordResetEmail = async (user, resetUrl) =>
  sendEmail({
    to: user.email,
    subject: "Reset your password",
    html: `<p>Reset your password using this link: ${resetUrl}</p>`,
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
