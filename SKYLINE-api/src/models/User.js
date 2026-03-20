const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullName: String,
  avatar: String,

  currentRank: String,
  points: Number,
  nextRank: String,
  nextThreshold: Number,

  email: {
    type: String,
    required: true,
    unique: true
  },

  password: {
    type: String,
    required: true
  },

  phone: String,

  birthday: Date,
  gender: String,

  passport: String,
  passportExpiry: Date,

  country: String,
  address: String,

  status: {
    type: String,
    default: "active"
  },

  resetPassword: {
    otpHash: String,
    otpExpireAt: Date,
    otpLastSentAt: Date,
    verifiedTokenHash: String,
    verifiedTokenExpireAt: Date,
    failedOtpAttempts: {
      type: Number,
      default: 0
    }
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", userSchema);