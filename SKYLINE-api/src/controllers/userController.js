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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendForgotPasswordOtpEmail({ toEmail, fullName, otpCode, expireMinutes }) {
  const transporter = await getMailer();
  const from =
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    process.env.SKYLINE_GMAIL_USER ||
    process.env.SMTP_USER ||
    "no-reply@skyline.local";

  const safeFullName = escapeHtml(fullName || "Quý khách");
  const safeOtp = escapeHtml(otpCode);
  const otpExpire = Number(expireMinutes) || 10;

  const html = `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>SKYLINE - Mã OTP đặt lại mật khẩu</title>
      </head>
      <body style="margin:0;padding:18px;background:#f1f5f9;">
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;max-width:680px;margin:0 auto;padding:24px;border:1px solid #dbeafe;border-radius:14px;background:#f8fbff;">
          <h2 style="margin:0 0 12px;color:#1d4ed8;">SKYLINE - Xác nhận quên mật khẩu</h2>
          <p style="margin:0 0 16px;">Xin chào <strong>${safeFullName}</strong>, bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản SKYLINE.</p>

          <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;">
            <tbody>
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Mã OTP</strong></td>
                <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong style="font-size:24px;letter-spacing:4px;color:#1f3f68;">${safeOtp}</strong></td>
              </tr>
              <tr>
                <td style="padding:10px 12px;"><strong>Hiệu lực</strong></td>
                <td style="padding:10px 12px;">${otpExpire} phút</td>
              </tr>
            </tbody>
          </table>

          <p style="margin-top:14px;color:#475569;">Vui lòng không chia sẻ mã OTP với bất kỳ ai để bảo mật tài khoản.</p>
          <p style="margin:8px 0 0;color:#9a3412;"><strong>Lưu ý:</strong> Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
        </div>
      </body>
    </html>
  `;

  const text = [
    "SKYLINE - Xác nhận quên mật khẩu",
    "",
    `Xin chào ${fullName || "Quý khách"},`,
    "",
    `Mã OTP để đặt lại mật khẩu của bạn là: ${otpCode}`,
    `Mã có hiệu lực trong ${otpExpire} phút.`,
    "",
    "Vui lòng không chia sẻ mã OTP với bất kỳ ai.",
    "Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.",
  ].join("\n");

  if (!transporter) {
    const error = new Error(
      "Chưa cấu hình SMTP hợp lệ. Nếu dùng Gmail, cần SMTP_USER và Gmail App Password (16 ký tự), không dùng mật khẩu đăng nhập thường."
    );
    error.statusCode = 500;
    throw error;
  }

  try {
    await transporter.sendMail({
      from: `SKYLINE <${from}>`,
      to: toEmail,
      subject: "[SKYLINE] Mã OTP đặt lại mật khẩu",
      text,
      html,
    });
  } catch (mailerError) {
    const code = String(mailerError?.code || "").toUpperCase();
    const responseCode = Number(mailerError?.responseCode || 0);
    const message = String(mailerError?.message || "");

    if (code === "EAUTH" || responseCode === 535) {
      const error = new Error("Xác thực SMTP thất bại. Nếu dùng Gmail, hãy bật 2-Step Verification và dùng App Password 16 ký tự cho SMTP_PASS.");
      error.statusCode = 500;
      throw error;
    }

    if (message.toLowerCase().includes("sender") || responseCode === 550) {
      const error = new Error("Email gửi (SMTP_FROM) chưa được verify trên nhà cung cấp mail.");
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
      return res.status(400).json({ success: false, message: "Vui lòng nhập email." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Email không tồn tại trong hệ thống." });
    }

    const now = Date.now();
    const lastSentAt = user.resetPassword?.otpLastSentAt ? new Date(user.resetPassword.otpLastSentAt).getTime() : 0;
    const diffSeconds = Math.floor((now - lastSentAt) / 1000);
    if (lastSentAt && diffSeconds < RESEND_COOLDOWN_SECONDS) {
      return res.status(429).json({
        success: false,
        message: `Vui lòng đợi ${RESEND_COOLDOWN_SECONDS - diffSeconds} giây để gửi lại mã.`,
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
      message: "Đã gửi mã OTP qua email. Vui lòng kiểm tra hộp thư.",
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
      return res.status(400).json({ success: false, message: "Email và OTP là bắt buộc." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Email không tồn tại trong hệ thống." });
    }

    const otpHash = user.resetPassword?.otpHash;
    const otpExpireAt = user.resetPassword?.otpExpireAt ? new Date(user.resetPassword.otpExpireAt).getTime() : 0;
    const failedAttempts = Number(user.resetPassword?.failedOtpAttempts || 0);

    if (failedAttempts >= MAX_FAILED_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Bạn đã nhập sai OTP quá nhiều lần. Vui lòng gửi lại mã OTP mới.",
      });
    }

    if (!otpHash || !otpExpireAt) {
      return res.status(400).json({ success: false, message: "Không tìm thấy yêu cầu đặt lại mật khẩu. Vui lòng gửi lại OTP." });
    }

    if (Date.now() > otpExpireAt) {
      return res.status(400).json({ success: false, message: "Mã OTP đã hết hạn. Vui lòng gửi lại OTP mới." });
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
          message: "Bạn đã nhập sai OTP quá 5 lần. OTP cũ đã bị hủy, vui lòng gửi lại mã mới.",
        });
      }

      return res.status(400).json({
        success: false,
        message: `Mã OTP không đúng. Còn ${MAX_FAILED_OTP_ATTEMPTS - failedOtpAttempts} lần thử.`,
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
      message: "Xác nhận OTP thành công.",
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
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin." });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Mật khẩu xác nhận không khớp." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "Email không tồn tại trong hệ thống." });
    }

    const tokenHash = user.resetPassword?.verifiedTokenHash;
    const tokenExpireAt = user.resetPassword?.verifiedTokenExpireAt
      ? new Date(user.resetPassword.verifiedTokenExpireAt).getTime()
      : 0;

    if (!tokenHash || !tokenExpireAt) {
      return res.status(400).json({ success: false, message: "Phiên đặt lại mật khẩu không hợp lệ. Vui lòng xác nhận OTP lại." });
    }

    if (Date.now() > tokenExpireAt) {
      return res.status(400).json({ success: false, message: "Phiên đặt lại mật khẩu đã hết hạn. Vui lòng thực hiện lại." });
    }

    if (hashRaw(resetToken) !== tokenHash) {
      return res.status(400).json({ success: false, message: "Token đặt lại mật khẩu không hợp lệ." });
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

    return res.json({ success: true, message: "Đổi mật khẩu thành công." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const payload = { ...req.body };
    delete payload._id;

    if (payload.birthday === "") payload.birthday = null;
    if (payload.passportExpiry === "") payload.passportExpiry = null;

    if (payload.password === "" || payload.password === null) {
      delete payload.password;
    }

    if (payload.password !== undefined) {
      payload.password = await bcrypt.hash(String(payload.password), 10);
    }

    const updated = await User.findByIdAndUpdate(req.params.id, payload, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Deleted" });
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