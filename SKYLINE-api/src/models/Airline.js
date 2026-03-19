const mongoose = require("mongoose");

const airlineSchema = new mongoose.Schema({
  airlineCode: String,
  airlineName: String,
  img: String,
  logo: String,
  country: String,
  hotline: String,
  commissionRate: Number,
  status: String,// active, inactive,deleted
},
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = mongoose.model("Airline", airlineSchema);
