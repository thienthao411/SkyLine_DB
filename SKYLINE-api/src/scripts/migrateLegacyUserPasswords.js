require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

function isBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$/.test(String(value || ""));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("Missing MONGO_URI in environment variables.");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find({}, { email: 1, password: 1 }).lean();
  let updatedCount = 0;

  for (const user of users) {
    const password = String(user.password || "");
    const normalizedEmail = normalizeEmail(user.email);
    const updates = {};

    if (!isBcryptHash(password) && password) {
      updates.password = await bcrypt.hash(password, 10);
    }

    if (String(user.email || "") !== normalizedEmail && normalizedEmail) {
      updates.email = normalizedEmail;
    }

    if (Object.keys(updates).length > 0) {
      await User.updateOne({ _id: user._id }, { $set: updates });
      updatedCount += 1;
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} user(s).`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Migration failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // no-op
  }
  process.exit(1);
});
