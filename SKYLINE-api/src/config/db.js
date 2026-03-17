const mongoose = require('mongoose');

module.exports = async () => {
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