const mongoose = require('mongoose');

const jobApplicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecruitmentJob',
      required: true
    },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '', trim: true },
    coverLetter: { type: String, default: '', trim: true },
    cvUrl: { type: String, default: '' },
    cvFileName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['new', 'reviewing', 'shortlisted', 'rejected'],
      default: 'new'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('JobApplication', jobApplicationSchema);
