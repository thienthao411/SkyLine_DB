const mongoose = require('mongoose');

const recruitmentActivitySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        'job_created',
        'job_updated',
        'job_deleted',
        'application_submitted',
        'application_status_updated'
      ],
      required: true
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobApplication',
      default: null
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecruitmentJob',
      default: null
    },
    applicantName: { type: String, default: '', trim: true },
    applicantEmail: { type: String, default: '', trim: true, lowercase: true },
    previousStatus: { type: String, default: '', trim: true },
    nextStatus: { type: String, default: '', trim: true },
    emailSent: { type: Boolean, default: false },
    emailMessageId: { type: String, default: '', trim: true },
    emailError: { type: String, default: '', trim: true },
    updatedBy: { type: String, default: 'admin', trim: true }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('RecruitmentActivity', recruitmentActivitySchema);
