const nodemailer = require('nodemailer');

const SKYLINE_SENDER = 'skyline.uel@gmail.com';
const DEFAULT_RECRUITMENT_ADMIN_EMAIL = 'skyline.admin.uel@gmail.com';

function resolveSenderEmail() {
  return String(process.env.SKYLINE_GMAIL_USER || process.env.MAIL_FROM || SKYLINE_SENDER).trim();
}

function resolveMailPassword() {
  return (
    process.env.SKYLINE_GMAIL_APP_PASSWORD ||
    process.env.SKYLINE_GMAIL_PASSWORD ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.MAIL_APP_PASSWORD ||
    ''
  );
}

function createTransporter() {
  const sender = resolveSenderEmail();
  const appPassword = resolveMailPassword();

  if (!sender || !appPassword) {
    throw new Error('Thiếu cấu hình Gmail. Cần SKYLINE_GMAIL_USER và SKYLINE_GMAIL_APP_PASSWORD trong .env');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: sender,
      pass: appPassword
    }
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mapStatusToContent(status) {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'shortlisted') {
    return {
      subjectPrefix: 'Hồ sơ vào vòng tiếp theo',
      heading: 'Chúc mừng! Hồ sơ của bạn đã vào vòng tiếp theo',
      message: 'Đội ngũ Skyline đã đánh giá hồ sơ và mời bạn tham gia vòng phỏng vấn tiếp theo. Bộ phận tuyển dụng sẽ liên hệ để hẹn lịch chi tiết.'
    };
  }

  if (normalized === 'rejected') {
    return {
      subjectPrefix: 'Cập nhật kết quả tuyển dụng',
      heading: 'Cảm ơn bạn đã ứng tuyển tại Skyline',
      message: 'Hiện tại hồ sơ của bạn chưa phù hợp với vị trí này. Skyline sẽ lưu hồ sơ và ưu tiên liên hệ nếu có cơ hội phù hợp hơn trong tương lai.'
    };
  }

  if (normalized === 'reviewing') {
    return {
      subjectPrefix: 'Hồ sơ đang được xem xét',
      heading: 'Hồ sơ của bạn đang được đội ngũ Skyline xem xét',
      message: 'Đội ngũ tuyển dụng đang đánh giá hồ sơ chi tiết. Skyline sẽ phản hồi bạn sớm nhất khi có kết quả tiếp theo.'
    };
  }

  return {
    subjectPrefix: 'Cập nhật trạng thái hồ sơ',
    heading: 'Trạng thái hồ sơ ứng tuyển của bạn đã được cập nhật',
    message: `Trạng thái hiện tại: ${normalized || 'new'}. Skyline sẽ tiếp tục cập nhật cho bạn trong các bước tiếp theo.`
  };
}

function resolveRecruitmentAdminRecipient() {
  return String(process.env.RECRUITMENT_ADMIN_EMAIL || DEFAULT_RECRUITMENT_ADMIN_EMAIL).trim().toLowerCase();
}

function buildNewApplicationEmailHtml({ applicantName, applicantEmail, phone, jobTitle, coverLetter, cvUrl }) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;max-width:680px;margin:0 auto;padding:24px;border:1px solid #dbeafe;border-radius:14px;background:#f8fbff;">
      <h2 style="margin:0 0 12px;color:#1d4ed8;">SKYLINE - Hồ sơ ứng tuyển mới</h2>
      <p style="margin:0 0 14px;">Bạn vừa nhận được một hồ sơ ứng tuyển mới từ website Skyline.</p>

      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;">
        <tbody>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Vị trí</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(jobTitle || 'Đang cập nhật')}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Họ tên</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(applicantName || 'N/A')}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Email</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(applicantEmail || 'N/A')}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Số điện thoại</strong></td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(phone || 'Chưa cung cấp')}</td></tr>
          <tr><td style="padding:10px 12px;"><strong>CV</strong></td><td style="padding:10px 12px;"><a href="${escapeHtml(cvUrl || '#')}" target="_blank" rel="noopener noreferrer">Mở CV ứng viên</a></td></tr>
        </tbody>
      </table>

      <p style="margin-top:14px;color:#475569;"><strong>Thư giới thiệu:</strong></p>
      <p style="margin-top:8px;padding:12px;border-radius:8px;background:#ffffff;border:1px solid #e2e8f0;color:#334155;">${escapeHtml(coverLetter || 'Không có thư giới thiệu')}</p>
    </div>
  `;
}

function buildApplicationStatusEmailHtml({ applicantName, jobTitle, status }) {
  const content = mapStatusToContent(status);

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;max-width:680px;margin:0 auto;padding:24px;border:1px solid #dbeafe;border-radius:14px;background:#f8fbff;">
      <h2 style="margin:0 0 12px;color:#1d4ed8;">SKYLINE - Tuyển dụng</h2>
      <p style="margin:0 0 14px;">Xin chào <strong>${escapeHtml(applicantName || 'Ứng viên')}</strong>,</p>
      <p style="margin:0 0 14px;">${escapeHtml(content.heading)}</p>

      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;">
        <tbody>
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><strong>Vị trí</strong></td>
            <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(jobTitle || 'Đang cập nhật')}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;"><strong>Trạng thái</strong></td>
            <td style="padding:10px 12px;text-transform:capitalize;">${escapeHtml(String(status || 'new'))}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin-top:14px;color:#475569;">${escapeHtml(content.message)}</p>
      <p style="margin-top:10px;color:#475569;">Trân trọng,<br><strong>Đội ngũ tuyển dụng SKYLINE</strong></p>
    </div>
  `;
}

async function sendApplicationStatusEmail({ toEmail, applicantName, jobTitle, status }) {
  const recipient = String(toEmail || '').trim().toLowerCase();
  if (!recipient) {
    return { sent: false, reason: 'missing-recipient' };
  }

  const content = mapStatusToContent(status);
  const transporter = createTransporter();
  const sender = resolveSenderEmail();
  const html = buildApplicationStatusEmailHtml({ applicantName, jobTitle, status });

  const mailResult = await transporter.sendMail({
    from: `SKYLINE <${sender}>`,
    to: recipient,
    subject: `[SKYLINE] ${content.subjectPrefix} - ${jobTitle || 'Ứng tuyển'}`,
    html
  });

  return {
    sent: true,
    messageId: mailResult?.messageId || '',
    recipient
  };
}

async function sendNewApplicationEmailToAdmin({ applicantName, applicantEmail, phone, jobTitle, coverLetter, cvUrl }) {
  const recipient = resolveRecruitmentAdminRecipient();
  if (!recipient) {
    return { sent: false, reason: 'missing-admin-recipient' };
  }

  const transporter = createTransporter();
  const sender = resolveSenderEmail();
  const html = buildNewApplicationEmailHtml({ applicantName, applicantEmail, phone, jobTitle, coverLetter, cvUrl });

  const mailResult = await transporter.sendMail({
    from: `SKYLINE <${sender}>`,
    to: recipient,
    subject: `[SKYLINE] Hồ sơ ứng tuyển mới - ${jobTitle || 'Vị trí tuyển dụng'}`,
    html
  });

  return {
    sent: true,
    messageId: mailResult?.messageId || '',
    recipient
  };
}

module.exports = {
  sendApplicationStatusEmail,
  sendNewApplicationEmailToAdmin
};
