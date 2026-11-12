const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const getPublicUrl = require('../config/publicUrl');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured');
}

const register = async (req, res) => {
  const { name, email, phone, password, role, location } = req.body;
  if (!name || !email || !phone || !password || !role || !location) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  if (!['farmer', 'buyer'].includes(role)) {
    return res.status(400).json({ message: 'Only farmer and buyer accounts can self-register' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    await User.create({
      name,
      email: normalizedEmail,
      phone,
      role,
      location,
      password
    });
    return res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Registration failed' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: '5h' }
    );
    return res.status(200).json({ message: 'Login success', token, role: user.role });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed' });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const requiredMailConfig = [
    process.env.SMTP_HOST,
    process.env.SMTP_PORT,
    process.env.SMTP_USER,
    process.env.SMTP_PASS,
    process.env.SMTP_FROM
  ];
  if (requiredMailConfig.some(value => !value)) {
    return res.status(503).json({ message: 'Password reset email is not configured' });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = new URL('/reset_password.html', getPublicUrl(req));
    resetUrl.searchParams.set('token', resetToken);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: 'Password Reset Request',
        text: `Use this link to reset your password: ${resetUrl.toString()}`,
        html: `<p>Use this link to reset your password:</p><a href="${resetUrl.toString()}">Reset password</a>`
      });
    } catch (error) {
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      await user.save();
      console.error('Password reset email delivery failed:', error.message);
      return res.status(503).json({ message: 'Could not send password reset email' });
    }

    return res.json({ message: 'Reset link sent to your email.' });
  } catch (error) {
    return res.status(500).json({ message: 'Could not process password reset request' });
  }
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (typeof token !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ message: 'A valid token and password of at least 8 characters are required' });
  }

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpiry: { $gt: new Date() }
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    return res.json({ message: 'Password reset successful' });
  } catch (error) {
    return res.status(500).json({ message: 'Could not reset password' });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword
};
