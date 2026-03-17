const User = require("../models/User");
const mongoose = require("mongoose");

exports.createUser = async (req, res) => {
  try {

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

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
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