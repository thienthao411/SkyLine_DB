const mongoose = require('mongoose');

module.exports = async () => {
  const fileOnly = String(process.env.AI_CHAT_DATA_SOURCE || "").trim().toLowerCase() === "file";
  const skipDb = String(process.env.SKIP_DB_ON_START || "").trim() === "true";
  if (fileOnly || skipDb) {
    console.warn('MongoDB connection skipped (file data mode enabled)');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    
    // Debug: kiểm tra database hiện tại
    console.log('Current DB:', mongoose.connection.name);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};