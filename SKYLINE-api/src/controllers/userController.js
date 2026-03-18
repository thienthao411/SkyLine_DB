const User = require("../models/User");
const RankBenefit = require("../models/RankBenefit");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.createUser = async (req, res) => {
  try {
    // Hash password nếu có trong request body
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const user = new User(req.body);

    const savedUser = await user.save();

    res.status(201).json(savedUser);

  } catch (error) {

    res.status(500).json({ error: error.message });

  }
};

exports.getUsers = async (req, res) => {
  try {
    console.log('=== DEBUG getUsers ===');
    console.log('Database name:', mongoose.connection.name);
    console.log('Collection name:', User.collection.name);
    console.log('Model name:', User.modelName);
    
    const users = await User.find();
    console.log('Users found:', users.length);
    console.log('Users data:', users);
    
    res.json(users);
  } catch (error) {
    console.log('Error fetching users:', error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.getUserById = async (req, res) => {

  try {

    const user = await User.findById(req.params.id);

    res.json(user);

  } catch (error) {

    res.status(500).json({ error: error.message });

  }

};

exports.getUserByEmail = async (req, res) => {
  try {
    console.log('Fetching user by email:', req.params.email);
    const user = await User.findOne({ email: req.params.email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log('User found:', user.fullName);
    res.json(user);
  } catch (error) {
    console.log('Error fetching user:', error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được đăng ký!'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới với các giá trị mặc định
    const user = new User({
      fullName: fullName,
      email: email,
      password: hashedPassword,
      avatar: 'assets/img/AVT1.jpg',
      currentRank: 'Đồng',
      points: 0,
      nextRank: 'Bạc',
      nextThreshold: 500,
      country: 'Việt Nam',
      status: 'active',
      phone: '',
      birthday: null,
      gender: '',
      passport: '',
      passportExpiry: null,
      address: ''
    });

    const savedUser = await user.save();

    // Tạo JWT token
    const token = jwt.sign(
      { userId: savedUser._id, email: savedUser.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Trả về user (không bao gồm password) và token
    const userResponse = savedUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công!',
      user: userResponse,
      token: token
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Tìm user theo email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng!'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng!'
      });
    }

    // Tạo JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Trả về user (không bao gồm password) và token
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      user: userResponse,
      token: token
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const payload = { ...req.body };

    // Avoid immutable field update errors when client sends whole object.
    delete payload._id;

    if (payload.birthday === '') payload.birthday = null;
    if (payload.passportExpiry === '') payload.passportExpiry = null;
    if (payload.password !== undefined && String(payload.password).trim() === '') {
      delete payload.password;
    }

    const updated = await User.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRankBenefits = async (_req, res) => {
  try {
    const rows = await RankBenefit.find({}, { rankKey: 1, name: 1, benefits: 1, order: 1, _id: 0 })
      .sort({ order: 1, rankKey: 1 })
      .lean();

    const ranks = rows.reduce((acc, row) => {
      acc[row.rankKey] = {
        name: row.name,
        benefits: Array.isArray(row.benefits) ? row.benefits : [],
      };
      return acc;
    }, {});

    res.json({ ranks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};