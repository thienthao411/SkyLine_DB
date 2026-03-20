const User = require("../models/User");
const RankBenefit = require("../models/RankBenefit");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const RESET_OTP_EXPIRE_MINUTES = 10;
const VERIFY_TOKEN_EXPIRE_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_FAILED_OTP_ATTEMPTS = 5;

let cachedMailer = null;

function isPlaceholderSecret(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    !normalized ||
    normalized === "your_sendgrid_api_key" ||
    normalized === "your_gmail_app_password" ||
    normalized.includes("your_")
  );
}

async function getMailer() {
  if (cachedMailer) {
    return cachedMailer;
  }

  const skylineGmailUser = process.env.SKYLINE_GMAIL_USER;
  const skylineGmailPass = process.env.SKYLINE_GMAIL_APP_PASSWORD;
  const sendGridApiKey = process.env.SENDGRID_API_KEY;
  const brevoSmtpKey = process.env.BREVO_SMTP_KEY;
  const host =
    process.env.SMTP_HOST ||
    (skylineGmailUser && skylineGmailPass ? "smtp.gmail.com" : "") ||
    (sendGridApiKey ? "smtp.sendgrid.net" : "") ||
    (brevoSmtpKey ? "smtp-relay.brevo.com" : "");
  const user =
    process.env.SMTP_USER ||
    skylineGmailUser ||
    (sendGridApiKey ? "apikey" : "") ||
    process.env.BREVO_SMTP_USER ||
    "";
  const pass = process.env.SMTP_PASS || skylineGmailPass || sendGridApiKey || brevoSmtpKey || "";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  if (!host || !user || !pass || isPlaceholderSecret(pass)) {
    return null;
  }

  cachedMailer = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return cachedMailer;
}

function hashRaw(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function createOtpCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function createResetVerifiedToken() {
  return crypto.randomBytes(32).toString("hex");
}

function isStrongPassword(password) {
  return String(password || "").length >= 6;
}

async function sendForgotPasswordOtpEmail({ toEmail, fullName, otpCode, expireMinutes }) {
  const transporter = await getMailer();
  const from =
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    process.env.SKYLINE_GMAIL_USER ||
    process.env.SMTP_USER ||
    "no-reply@skyline.local";

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="margin-bottom: 8px;">SKYLINE - Xac nhan quen mat khau</h2>
      <p>Xin chao ${fullName || "Quy khach"},</p>
      <p>Ma OTP de dat lai mat khau cua ban la:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 12px 0;">${otpCode}</p>
      <p>Ma co hieu luc trong ${expireMinutes} phut.</p>
      <p>Neu ban khong yeu cau dat lai mat khau, vui long bo qua email nay.</p>
    </div>
  `;

  if (!transporter) {
    const error = new Error(
      "Chua cau hinh SMTP hop le. Neu dung Gmail, can SMTP_USER va Gmail App Password (16 ky tu), khong dung mat khau dang nhap thuong."
    );
    error.statusCode = 500;
    throw error;
  }

  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: "[SKYLINE] Ma OTP dat lai mat khau",
      html,
    });
  } catch (mailerError) {
    const code = String(mailerError?.code || "").toUpperCase();
    const responseCode = Number(mailerError?.responseCode || 0);
    const message = String(mailerError?.message || "");

    if (code === "EAUTH" || responseCode === 535) {
      const error = new Error("Xac thuc SMTP that bai. Neu dung Gmail, hay bat 2-Step Verification va dung App Password 16 ky tu cho SMTP_PASS.");
      error.statusCode = 500;
      throw error;
    }

    if (message.toLowerCase().includes("sender") || responseCode === 550) {
      const error = new Error("Email gui (SMTP_FROM) chua duoc verify tren nha cung cap mail.");
      error.statusCode = 500;
      throw error;
    }

    throw mailerError;
  }
}

exports.createUser = async (req, res) => {
  try {
    // Hash password nếu có trong request body
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const user = new User(req.body);

    const savedUser = await user.save();

    res.status(201).json(savedUser);

  } catch (error) {

    res.status(500).json({ error: error.message });

  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserById = async (req, res) => {

  try {

    const user = await User.findById(req.params.id);

    res.json(user);

  } catch (error) {

    res.status(500).json({ error: error.message });

  }

};

exports.getUserByEmail = async (req, res) => {
  try {
    console.log('Fetching user by email:', req.params.email);
    const user = await User.findOne({ email: req.params.email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log('User found:', user.fullName);
    res.json(user);
  } catch (error) {
    console.log('Error fetching user:', error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được đăng ký!'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới với các giá trị mặc định
    const user = new User({
      fullName: fullName,
      email: email,
      password: hashedPassword,
      avatar: 'assets/img/AVT1.jpg',
      currentRank: 'Đồng',
      points: 0,
      nextRank: 'Bạc',
      nextThreshold: 500,
      country: 'Việt Nam',
      status: 'active',
      phone: '',
      birthday: null,
      gender: '',
      passport: '',
      passportExpiry: null,
      address: ''
    });

    const savedUser = await user.save();

    // Tạo JWT token
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Trả về user (không bao gồm password) và token
    const userResponse = savedUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công!',
      user: userResponse,
      token: token
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Tìm user theo email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng!'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng!'
      });
    }

    // Tạo JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Trả về user (không bao gồm password) và token
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      user: userResponse,
      token: token
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, message: "Vui long nhap email." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Email khong ton tai trong he thong." });
    }

    const now = Date.now();
    const lastSentAt = user.resetPassword?.otpLastSentAt ? new Date(user.resetPassword.otpLastSentAt).getTime() : 0;
    const diffSeconds = Math.floor((now - lastSentAt) / 1000);
    if (lastSentAt && diffSeconds < RESEND_COOLDOWN_SECONDS) {
      return res.status(429).json({
        success: false,
        message: `Vui long doi ${RESEND_COOLDOWN_SECONDS - diffSeconds} giay de gui lai ma.`,
      });
    }

    const otpCode = createOtpCode();
    const otpHash = hashRaw(otpCode);
    const expireAt = new Date(now + RESET_OTP_EXPIRE_MINUTES * 60 * 1000);

    user.resetPassword = {
      ...(user.resetPassword || {}),
      otpHash,
      otpExpireAt: expireAt,
      otpLastSentAt: new Date(now),
      verifiedTokenHash: undefined,
      verifiedTokenExpireAt: undefined,
      failedOtpAttempts: 0,
    };

    await user.save();
    await sendForgotPasswordOtpEmail({
      toEmail: user.email,
      fullName: user.fullName,
      otpCode,
      expireMinutes: RESET_OTP_EXPIRE_MINUTES,
    });

    return res.json({
      success: true,
      message: "Da gui ma OTP qua email. Vui long kiem tra hop thu.",
      expiresInMinutes: RESET_OTP_EXPIRE_MINUTES,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const otp = String(req.body?.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email va OTP la bat buoc." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Email khong ton tai trong he thong." });
    }

    const otpHash = user.resetPassword?.otpHash;
    const otpExpireAt = user.resetPassword?.otpExpireAt ? new Date(user.resetPassword.otpExpireAt).getTime() : 0;
    const failedAttempts = Number(user.resetPassword?.failedOtpAttempts || 0);

    if (failedAttempts >= MAX_FAILED_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Ban da nhap sai OTP qua nhieu lan. Vui long gui lai ma OTP moi.",
      });
    }

    if (!otpHash || !otpExpireAt) {
      return res.status(400).json({ success: false, message: "Khong tim thay yeu cau dat lai mat khau. Vui long gui lai OTP." });
    }

    if (Date.now() > otpExpireAt) {
      return res.status(400).json({ success: false, message: "Ma OTP da het han. Vui long gui lai OTP moi." });
    }

    const providedHash = hashRaw(otp);
    if (providedHash !== otpHash) {
      const failedOtpAttempts = failedAttempts + 1;
      user.resetPassword = {
        ...(user.resetPassword || {}),
        failedOtpAttempts,
      };

      if (failedOtpAttempts >= MAX_FAILED_OTP_ATTEMPTS) {
        user.resetPassword.otpHash = undefined;
        user.resetPassword.otpExpireAt = undefined;
      }

      await user.save();

      if (failedOtpAttempts >= MAX_FAILED_OTP_ATTEMPTS) {
        return res.status(429).json({
          success: false,
          message: "Ban da nhap sai OTP qua 5 lan. OTP cu da bi huy, vui long gui lai ma moi.",
        });
      }

      return res.status(400).json({
        success: false,
        message: `Ma OTP khong dung. Con ${MAX_FAILED_OTP_ATTEMPTS - failedOtpAttempts} lan thu.`,
      });
    }

    const verifiedToken = createResetVerifiedToken();
    const verifiedTokenHash = hashRaw(verifiedToken);
    const verifiedTokenExpireAt = new Date(Date.now() + VERIFY_TOKEN_EXPIRE_MINUTES * 60 * 1000);

    user.resetPassword = {
      ...(user.resetPassword || {}),
      verifiedTokenHash,
      verifiedTokenExpireAt,
      failedOtpAttempts: 0,
    };
    await user.save();

    return res.json({
      success: true,
      message: "Xac nhan OTP thanh cong.",
      resetToken: verifiedToken,
      expiresInMinutes: VERIFY_TOKEN_EXPIRE_MINUTES,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const resetToken = String(req.body?.resetToken || "").trim();
    const newPassword = String(req.body?.newPassword || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    if (!email || !resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Vui long nhap day du thong tin." });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ success: false, message: "Mat khau moi phai co it nhat 6 ky tu." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Mat khau xac nhan khong khop." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Email khong ton tai trong he thong." });
    }

    const tokenHash = user.resetPassword?.verifiedTokenHash;
    const tokenExpireAt = user.resetPassword?.verifiedTokenExpireAt
      ? new Date(user.resetPassword.verifiedTokenExpireAt).getTime()
      : 0;

    if (!tokenHash || !tokenExpireAt) {
      return res.status(400).json({ success: false, message: "Phien dat lai mat khau khong hop le. Vui long xac nhan OTP lai." });
    }

    if (Date.now() > tokenExpireAt) {
      return res.status(400).json({ success: false, message: "Phien dat lai mat khau da het han. Vui long thuc hien lai." });
    }

    if (hashRaw(resetToken) !== tokenHash) {
      return res.status(400).json({ success: false, message: "Token dat lai mat khau khong hop le." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPassword = {
      otpHash: undefined,
      otpExpireAt: undefined,
      otpLastSentAt: undefined,
      verifiedTokenHash: undefined,
      verifiedTokenExpireAt: undefined,
      failedOtpAttempts: 0,
    };

    await user.save();

    return res.json({ success: true, message: "Doi mat khau thanh cong." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const payload = { ...req.body };

    // Avoid immutable field update errors when client sends whole object.
    delete payload._id;

    if (payload.birthday === '') payload.birthday = null;
    if (payload.passportExpiry === '') payload.passportExpiry = null;
    if (payload.password !== undefined && String(payload.password).trim() === '') {
      delete payload.password;
    }

    const updated = await User.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRankBenefits = async (_req, res) => {
  try {
    const rows = await RankBenefit.find({}, { rankKey: 1, name: 1, benefits: 1, order: 1, _id: 0 })
      .sort({ order: 1, rankKey: 1 })
      .lean();

    const ranks = rows.reduce((acc, row) => {
      acc[row.rankKey] = {
        name: row.name,
        benefits: Array.isArray(row.benefits) ? row.benefits : [],
      };
      return acc;
    }, {});

    res.json({ ranks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};