const mongoose = require('mongoose');

const recruitmentJobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    team: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    type: { type: String, default: 'Toàn thời gian', trim: true },
    level: { type: String, default: '', trim: true },
    salaryRange: { type: String, default: 'Thỏa thuận', trim: true },
    summary: { type: String, default: '', trim: true },
    skills: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('RecruitmentJob', recruitmentJobSchema);
