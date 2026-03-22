const RecruitmentJob = require('../models/RecruitmentJob');
const JobApplication = require('../models/JobApplication');
const RecruitmentActivity = require('../models/RecruitmentActivity');
const Notification = require('../models/Notification');
const NotificationUser = require('../models/NotificationUser');
const { uploadBufferToCloudinary } = require('../upload');
const { getIO } = require('../socket');
const {
  sendApplicationStatusEmail,
  sendNewApplicationEmailToAdmin
} = require('../services/recruitmentEmailService');

const DEFAULT_JOBS = [
  {
    title: 'Frontend Angular Developer',
    team: 'Product Engineering',
    location: 'Thủ Đức, TP.HCM',
    type: 'Toàn thời gian',
    level: 'Middle',
    salaryRange: '18 - 28 triệu',
    summary: 'Phát triển giao diện đặt vé, tối ưu trải nghiệm mobile và kết nối API booking theo thời gian thực.',
    skills: ['Angular', 'TypeScript', 'RxJS', 'SCSS'],
    status: 'open'
  },
  {
    title: 'Backend Node.js Developer',
    team: 'Platform Engineering',
    location: 'Hybrid',
    type: 'Toàn thời gian',
    level: 'Junior - Middle',
    salaryRange: '15 - 24 triệu',
    summary: 'Xây dựng API booking, xử lý đồng bộ vé/chuyến bay và tối ưu hiệu năng truy vấn MongoDB.',
    skills: ['Node.js', 'Express', 'MongoDB', 'Socket.IO'],
    status: 'open'
  },
  {
    title: 'Customer Care Executive',
    team: 'Customer Experience',
    location: 'Quận 1, TP.HCM',
    type: 'Theo ca',
    level: 'Entry - Junior',
    salaryRange: '8 - 12 triệu',
    summary: 'Hỗ trợ khách hàng trước và sau đặt vé, xử lý tình huống đổi lịch/chuyển hoàn theo SLA.',
    skills: ['Giao tiếp', 'CRM', 'Dịch vụ khách hàng', 'Tiếng Anh cơ bản'],
    status: 'open'
  }
];

let seeded = false;

async function ensureSeedJobs() {
  if (seeded) return;

  const count = await RecruitmentJob.countDocuments();
  if (count === 0) {
    await RecruitmentJob.insertMany(DEFAULT_JOBS);
  }

  seeded = true;
}

function normalizeSkills(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  return String(value || '')
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeJobPayload(payload = {}) {
  return {
    title: String(payload.title || '').trim(),
    team: String(payload.team || '').trim(),
    location: String(payload.location || '').trim(),
    type: String(payload.type || 'Toàn thời gian').trim(),
    level: String(payload.level || '').trim(),
    salaryRange: String(payload.salaryRange || 'Thỏa thuận').trim(),
    summary: String(payload.summary || '').trim(),
    skills: normalizeSkills(payload.skills),
    status: String(payload.status || 'open').trim().toLowerCase() === 'closed' ? 'closed' : 'open'
  };
}

function normalizeApplicationPayload(payload = {}) {
  return {
    jobId: payload.jobId,
    fullName: String(payload.fullName || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    phone: String(payload.phone || '').trim(),
    coverLetter: String(payload.coverLetter || '').trim()
  };
}

function handleError(res, error) {
  const statusCode =
    error.statusCode ||
    (error.name === 'ValidationError' || error.name === 'CastError' || error.name === 'MulterError' ? 400 : 500);

  return res.status(statusCode).json({ error: error.message });
}

async function createActivityLog(payload = {}) {
  const normalizedPayload = {
    action: payload.action,
    applicationId: payload.applicationId || null,
    jobId: payload.jobId || null,
    applicantName: String(payload.applicantName || '').trim(),
    applicantEmail: String(payload.applicantEmail || '').trim().toLowerCase(),
    previousStatus: String(payload.previousStatus || '').trim(),
    nextStatus: String(payload.nextStatus || '').trim(),
    emailSent: Boolean(payload.emailSent),
    emailMessageId: String(payload.emailMessageId || '').trim(),
    emailError: String(payload.emailError || '').trim(),
    updatedBy: String(payload.updatedBy || 'admin').trim() || 'admin'
  };

  try {
    if (payload.updateExistingByApplication && normalizedPayload.applicationId) {
      await RecruitmentActivity.findOneAndUpdate(
        { applicationId: normalizedPayload.applicationId },
        { $set: normalizedPayload },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
      );
      return;
    }

    await RecruitmentActivity.create(normalizedPayload);
  } catch (error) {
    console.error('Lỗi ghi log tuyển dụng:', error);
  }
}

async function createAdminRecruitmentNotification({ applicationId, applicantName, jobTitle }) {
  try {
    const normalizedApplicantName = String(applicantName || '').trim() || 'Ứng viên mới';
    const normalizedJobTitle = String(jobTitle || '').trim() || 'vị trí tuyển dụng';
    const normalizedApplicationId = String(applicationId || '').trim();

    if (!normalizedApplicationId) {
      return;
    }

    const notification = await Notification.create({
      title: 'Hồ sơ ứng tuyển mới',
      message: `${normalizedApplicantName} vừa nộp hồ sơ cho vị trí ${normalizedJobTitle}.`,
      bookingId: normalizedApplicationId,
      type: 'recruitment_application',
      isRead: false,
      createdAt: new Date()
    });

    const io = getIO();
    if (io) {
      io.to('admins').emit('admin_notification_created', notification.toObject());
    }
  } catch (error) {
    console.error('Lỗi tạo thông báo tuyển dụng cho admin:', error);
  }
}

function toRecruitmentStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'reviewing') return 'đang được xem xét';
  if (normalized === 'shortlisted') return 'đã được duyệt vào vòng tiếp theo';
  if (normalized === 'rejected') return 'chưa phù hợp ở đợt tuyển dụng này';
  return 'đã được cập nhật';
}

async function createApplicantStatusNotification(application, nextStatus) {
  try {
    const userEmail = String(application?.email || '').trim().toLowerCase();
    if (!userEmail) {
      return null;
    }

    const statusLabel = toRecruitmentStatusLabel(nextStatus);
    const title = 'Cập nhật hồ sơ ứng tuyển';
    const jobTitle = String(application?.jobId?.title || '').trim() || 'vị trí bạn đã ứng tuyển';
    const message = `Hồ sơ ứng tuyển cho ${jobTitle} ${statusLabel}.`;

    const duplicate = await NotificationUser.findOne({
      userEmail,
      bookingId: String(application?._id || ''),
      type: 'recruitment_status',
      paymentStatus: String(nextStatus || '').trim().toLowerCase(),
      isRead: false
    });

    if (duplicate) {
      return duplicate;
    }

    return NotificationUser.create({
      userEmail,
      title,
      message,
      bookingId: String(application?._id || ''),
      type: 'recruitment_status',
      paymentStatus: String(nextStatus || '').trim().toLowerCase(),
      isRead: false,
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Lỗi tạo thông báo trạng thái hồ sơ cho ứng viên:', error);
    return null;
  }
}

exports.getJobs = async (req, res) => {
  try {
    await ensureSeedJobs();
    const includeClosed = String(req.query.includeClosed || '').trim().toLowerCase() === 'true';
    const filter = includeClosed ? {} : { status: 'open' };
    const jobs = await RecruitmentJob.find(filter).sort({ createdAt: -1 }).lean();
    res.json(jobs);
  } catch (error) {
    handleError(res, error);
  }
};

exports.createJob = async (req, res) => {
  try {
    const payload = normalizeJobPayload(req.body);
    if (!payload.title) {
      return res.status(400).json({ error: 'Tiêu đề vị trí là bắt buộc.' });
    }

    const created = await RecruitmentJob.create(payload);

    await createActivityLog({
      action: 'job_created',
      jobId: created._id,
      nextStatus: created.status,
      updatedBy: req.body?.updatedBy || 'admin'
    });

    res.status(201).json(created);
  } catch (error) {
    handleError(res, error);
  }
};

exports.updateJob = async (req, res) => {
  try {
    const existing = await RecruitmentJob.findById(req.params.id).lean();
    if (!existing) {
      return res.status(404).json({ message: 'Không tìm thấy vị trí tuyển dụng.' });
    }

    const payload = normalizeJobPayload(req.body);
    if (!payload.title) {
      return res.status(400).json({ error: 'Tiêu đề vị trí là bắt buộc.' });
    }

    const updated = await RecruitmentJob.findByIdAndUpdate(req.params.id, payload, {
      returnDocument: 'after',
      runValidators: true
    });

    await createActivityLog({
      action: 'job_updated',
      jobId: updated._id,
      previousStatus: existing.status,
      nextStatus: updated.status,
      updatedBy: req.body?.updatedBy || 'admin'
    });

    res.json(updated);
  } catch (error) {
    handleError(res, error);
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const deleted = await RecruitmentJob.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Không tìm thấy vị trí tuyển dụng.' });
    }

    await createActivityLog({
      action: 'job_deleted',
      jobId: deleted._id,
      previousStatus: deleted.status,
      updatedBy: req.body?.updatedBy || 'admin'
    });

    res.json({ message: 'Đã xóa vị trí tuyển dụng.' });
  } catch (error) {
    handleError(res, error);
  }
};

exports.createApplication = async (req, res) => {
  try {
    const payload = normalizeApplicationPayload(req.body);

    if (!payload.jobId || !payload.fullName || !payload.email) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ vị trí, họ tên và email.' });
    }

    const job = await RecruitmentJob.findById(payload.jobId).select('_id status').lean();
    if (!job || job.status !== 'open') {
      return res.status(400).json({ error: 'Vị trí tuyển dụng không hợp lệ hoặc đã đóng.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng đính kèm CV (PDF/DOC/DOCX).' });
    }

    const uploadResult = await uploadBufferToCloudinary(req.file, {
      folder: 'skyline/recruitment-cv',
      publicId: `cv-${Date.now()}`,
      resourceType: 'raw'
    });

    const created = await JobApplication.create({
      ...payload,
      cvUrl: uploadResult?.secure_url || uploadResult?.url || '',
      cvFileName: req.file.originalname || ''
    });

    const populated = await JobApplication.findById(created._id)
      .populate('jobId', 'title team location')
      .lean();

    let adminMailSent = false;
    let adminMailMessageId = '';
    let adminMailError = '';

    try {
      const mailResult = await sendNewApplicationEmailToAdmin({
        applicantName: created.fullName,
        applicantEmail: created.email,
        phone: created.phone,
        jobTitle: populated?.jobId?.title || '',
        coverLetter: created.coverLetter,
        cvUrl: created.cvUrl
      });

      adminMailSent = Boolean(mailResult?.sent);
      adminMailMessageId = String(mailResult?.messageId || '');
    } catch (error) {
      adminMailSent = false;
      adminMailError = String(error?.message || 'Gửi email admin thất bại');
    }

    await createActivityLog({
      action: 'application_submitted',
      applicationId: created._id,
      jobId: payload.jobId,
      applicantName: payload.fullName,
      applicantEmail: payload.email,
      nextStatus: created.status,
      emailSent: adminMailSent,
      emailMessageId: adminMailMessageId,
      emailError: adminMailError,
      updatedBy: 'candidate'
    });

    await createAdminRecruitmentNotification({
      applicationId: created._id,
      applicantName: created.fullName,
      jobTitle: populated?.jobId?.title
    });

    res.status(201).json({
      ...populated,
      adminNotification: {
        emailSent: adminMailSent,
        emailMessageId: adminMailMessageId,
        emailError: adminMailError
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getApplications = async (req, res) => {
  try {
    const statusFilter = String(req.query.status || '').trim().toLowerCase();
    const filter = {};

    if (['new', 'reviewing', 'shortlisted', 'rejected'].includes(statusFilter)) {
      filter.status = statusFilter;
    }

    if (req.query.jobId) {
      filter.jobId = req.query.jobId;
    }

    const applications = await JobApplication.find(filter)
      .populate('jobId', 'title team location')
      .sort({ createdAt: -1 })
      .lean();

    res.json(applications);
  } catch (error) {
    handleError(res, error);
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const status = String(req.body.status || '').trim().toLowerCase();
    const allowed = ['new', 'reviewing', 'shortlisted', 'rejected'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Trạng thái hồ sơ không hợp lệ.' });
    }

    const current = await JobApplication.findById(req.params.id)
      .populate('jobId', 'title team location')
      .lean();

    if (!current) {
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ ứng tuyển.' });
    }

    const previousStatus = String(current.status || '').trim().toLowerCase();

    const updated = await JobApplication.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: 'after', runValidators: true }
    )
      .populate('jobId', 'title team location')
      .lean();

    let emailSent = false;
    let emailMessageId = '';
    let emailError = '';

    if (previousStatus !== status) {
      try {
        const emailResult = await sendApplicationStatusEmail({
          toEmail: updated.email,
          applicantName: updated.fullName,
          jobTitle: updated.jobId?.title || '',
          status
        });

        emailSent = Boolean(emailResult?.sent);
        emailMessageId = String(emailResult?.messageId || '');
      } catch (error) {
        emailSent = false;
        emailError = String(error?.message || 'Gửi email thất bại');
      }
    }

    await createActivityLog({
      action: 'application_status_updated',
      applicationId: updated._id,
      jobId: updated.jobId?._id || updated.jobId,
      applicantName: updated.fullName,
      applicantEmail: updated.email,
      previousStatus,
      nextStatus: status,
      emailSent,
      emailMessageId,
      emailError,
      updateExistingByApplication: true,
      updatedBy: req.body?.updatedBy || 'admin'
    });

    if (previousStatus !== status) {
      const userNotification = await createApplicantStatusNotification(updated, status);
      const userEmail = String(updated.email || '').trim().toLowerCase();
      if (userNotification && userEmail) {
        const io = getIO();
        if (io) {
          io.to(`user:${userEmail}`).emit('user_notification_created', userNotification.toObject());
        }
      }
    }

    res.json({
      ...updated,
      notification: {
        emailSent,
        emailMessageId,
        emailError
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getActivities = async (req, res) => {
  try {
    const activities = await RecruitmentActivity.find()
      .populate('jobId', 'title')
      .populate('applicationId', 'fullName email status')
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    res.json(activities);
  } catch (error) {
    handleError(res, error);
  }
};
