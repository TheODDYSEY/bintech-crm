const mongoose = require("mongoose");

const dealSchema = new mongoose.Schema({
  name: String,
  amount: String,
  stage: String,
  customerNumber: String,
  inquiryDate: String,
  customer: String,
  company: String,
  email: String,
  phone: String,
  source: String,
  product: String,
  brand: String,
  followUpPhone: String,
  followUpEmail: String,
  quotationDate: String
}, { timestamps: true });

module.exports = mongoose.model("Deal", dealSchema);
