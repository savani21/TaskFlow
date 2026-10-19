const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const auth = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

function issueToken(userId) {
  return jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

router.post("/register", asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({ success: false, message: "Name must be between 2 and 80 characters." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ success: false, message: "Password must be between 8 and 128 characters." });
  }

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ success: false, message: "An account with this email already exists." });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, password: passwordHash });
  const token = issueToken(user._id);

  res.status(201).json({
    success: true,
    token,
    data: { _id: user._id, name: user.name, email: user.email }
  });
}));

router.post("/forgot-password", asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }

  const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER &&
    process.env.SMTP_PASS && process.env.SMTP_FROM;
  if (!smtpConfigured) {
    return res.status(503).json({ success: false, message: "Password reset email is not configured on the server yet." });
  }

  const user = await User.findOne({ email });
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
    const resetUrl = `${clientUrl}/?resetToken=${rawToken}`;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: "Reset your TaskFlow password",
        text: `We received a request to reset your TaskFlow password. This link expires in 15 minutes: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>We received a request to reset your TaskFlow password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 15 minutes. If you did not request this, you can ignore this email.</p>`
      });
    } catch (error) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      throw error;
    }
  }

  res.json({ success: true, message: "If an account exists for that email, a password reset link has been sent." });
}));

router.post("/reset-password", asyncHandler(async (req, res) => {
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");
  if (!token || token.length > 256) {
    return res.status(400).json({ success: false, message: "This reset link is invalid or expired." });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ success: false, message: "Password must be between 8 and 128 characters." });
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() }
  }).select("+passwordResetToken +passwordResetExpires");

  if (!user) {
    return res.status(400).json({ success: false, message: "This reset link is invalid or expired. Request a new one." });
  }

  user.password = await bcrypt.hash(password, 12);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.json({ success: true, message: "Password reset successfully. You can now sign in." });
}));

router.post("/login", asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, message: "Invalid email or password." });
  }

  res.json({
    success: true,
    token: issueToken(user._id),
    data: { _id: user._id, name: user.name, email: user.email }
  });
}));

router.get("/me", auth, (req, res) => {
  res.json({ success: true, data: req.user });
});

module.exports = router;
