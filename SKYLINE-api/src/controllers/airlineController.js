const Airline = require("../models/Airline");

exports.getAirlines = async (req, res) => {
  try {
    const airlines = await Airline.find();
    res.json(airlines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createAirline = async (req, res) => {
  try {
    const airline = new Airline(req.body);
    const saved = await airline.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateAirline = async (req, res) => {
  try {
    const updated = await Airline.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Airline not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAirline = async (req, res) => {
  try {
    const deleted = await Airline.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Airline not found' });
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};