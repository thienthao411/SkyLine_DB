const nodemailer = require("nodemailer");

const SKYLINE_SENDER = "skyline.uel@gmail.com";

function resolveSenderEmail() {
  return String(process.env.SKYLINE_GMAIL_USER || process.env.MAIL_FROM || SKYLINE_SENDER).trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveMailPassword() {
  return (
    process.env.SKYLINE_GMAIL_APP_PASSWORD ||
    process.env.SKYLINE_GMAIL_PASSWORD ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.MAIL_APP_PASSWORD ||
    ""
  );
}

function createTransporter() {
  const sender = resolveSenderEmail();
  const appPassword = resolveMailPassword();
  if (!sender || !appPassword) {
    throw new Error("Thiếu cấu hình Gmail. Cần SKYLINE_GMAIL_USER và SKYLINE_GMAIL_APP_PASSWORD trong .env");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: sender,
      pass: appPassword,
    },
  });
}

function formatMoney(value, currency = "VND") {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "VND" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("vi-VN")} ${currency}`;
  }
}

function safe(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

function buildBookingEmailHtml(ticket) {
  const passengerName = safe(ticket?.passengerInfo?.fullName || ticket?.passengerInfo?.name);
  const passengerEmail = safe(ticket?.email || ticket?.passengerInfo?.email);
  const seat = safe(ticket?.seat);
  const seatType = safe(ticket?.seatType);
  const baggage = ticket?.baggageOption
    ? `${safe(ticket.baggageOption.code)} - ${safe(ticket.baggageOption.name)}`
    : "Không mua thêm";

  const flight = ticket?.flight || {};
  const currency = safe(flight.currency, "VND");
  const totalAmount = formatMoney(ticket?.totalAmount || ticket?.totalPrice || 0, currency);

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;max-width:680px;margin:0 auto;padding:24px;border:1px solid #dbeafe;border-radius:14px;background:#f8fbff;">
      <h2 style="margin:0 0 12px;color:#1d4ed8;">Vé điện tử SKYLINE</h2>
      <p style="margin:0 0 16px;">Thanh toán cho đơn <strong>${safe(ticket?.ticketCode)}</strong> đã được xác nhận.</p>

      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;">
        <tbody>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Hành khách</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${passengerName}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Email</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${passengerEmail}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Chuyến bay</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${safe(flight.flightNo)} | ${safe(flight.from)} -> ${safe(flight.to)}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Ngày bay</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${safe(flight.date)}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Giờ bay</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${safe(flight.departTime)} - ${safe(flight.arriveTime)}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Số ghế</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${seat} (${seatType})</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Hành lý</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${baggage}</td></tr>
          <tr><td style="padding:10px 12px;"><strong>Tổng thanh toán</strong></td><td style="padding:10px 12px;"><strong>${totalAmount}</strong></td></tr>
        </tbody>
      </table>

      <p style="margin-top:14px;color:#475569;">Cảm ơn bạn đã đặt vé tại SKYLINE. Chúc bạn có chuyến bay vui vẻ!</p>
    </div>
  `;
}

function buildAccountEmailHtml({ recipient, fullName, tempPassword }) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;max-width:680px;margin:0 auto;padding:24px;border:1px solid #dbeafe;border-radius:14px;background:#f8fbff;">
      <h2 style="margin:0 0 12px;color:#1d4ed8;">Tài khoản SKYLINE của bạn</h2>
      <p style="margin:0 0 16px;">Xin chào <strong>${safe(fullName, "Quý khách")}</strong>, hệ thống đã tạo tài khoản SKYLINE cho bạn.</p>

      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;">
        <tbody>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Email đăng nhập</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${safe(recipient)}</td></tr>
          <tr><td style="padding:10px 12px;"><strong>Mật khẩu tạm</strong></td><td style="padding:10px 12px;"><strong>${safe(tempPassword)}</strong></td></tr>
        </tbody>
      </table>

      <p style="margin-top:14px;color:#9a3412;"><strong>Lưu ý:</strong> Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên để bảo mật tài khoản.</p>
    </div>
  `;
}

async function sendBookingIssuedEmail({ ticket }) {
  const recipient = normalizeEmail(ticket?.email || ticket?.passengerInfo?.email);
  if (!recipient) {
    return { sent: false, reason: "missing-recipient" };
  }

  const transporter = createTransporter();
  const sender = resolveSenderEmail();
  const html = buildBookingEmailHtml(ticket);

  const mailResult = await transporter.sendMail({
    from: `SKYLINE <${sender}>`,
    to: recipient,
    subject: `[SKYLINE] Vé điện tử ${safe(ticket?.ticketCode)}`,
    html,
  });

  return {
    sent: true,
    messageId: mailResult?.messageId || "",
    recipient,
  };
}

async function sendAccountCredentialsEmail({ recipient, fullName, tempPassword }) {
  const to = normalizeEmail(recipient);
  if (!to || !tempPassword) {
    return { sent: false, reason: "missing-recipient-or-password" };
  }

  const transporter = createTransporter();
  const sender = resolveSenderEmail();
  const html = buildAccountEmailHtml({ recipient: to, fullName, tempPassword });

  const mailResult = await transporter.sendMail({
    from: `SKYLINE <${sender}>`,
    to,
    subject: `[SKYLINE] Thông tin tài khoản SKYLINE của bạn`,
    html,
  });

  return {
    sent: true,
    messageId: mailResult?.messageId || "",
    recipient: to,
  };
}

module.exports = {
  sendBookingIssuedEmail,
  sendAccountCredentialsEmail,
};
