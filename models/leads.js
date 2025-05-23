const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  customerNumber: String,
  name: String,
  company: String,
  email: String,
  phone: String,
  source: String,
  product: String,
  brand: String,
  inquiryDate: String
});

module.exports = mongoose.model('Lead', leadSchema);
