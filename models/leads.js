const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema({
  name: String,                // equivalent to customerName
  amount: String,              // optional; may be unused in leads
  stage: String,               // optional; e.g., New, Contacted
  customerNumber: String,
  inquiryDate: String,
  customer: String,            // same as name or customerName
  company: String,             // equivalent to companyName
  email: String,
  phone: String,
  source: String,
  product: String,
  brand: String,               // equivalent to category
  followUpPhone: String,
  followUpEmail: String,
  quotationDate: String
}, { timestamps: true });

module.exports = mongoose.model("Lead", leadSchema);
