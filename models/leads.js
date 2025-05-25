const mongoose = require("mongoose");
const validator = require('validator');

const leadSchema = new mongoose.Schema({
  customerNumber: {
    type: String,
    required: [true, 'Customer number is required'],
    unique: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email address'],
    index: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^\+?[1-9]\d{1,14}$/.test(v);
      },
      message: 'Please provide a valid phone number'
    },
    index: true
  },
  amount: {
    type: Number,
    min: [0, 'Amount cannot be negative'],
    default: 0
  },
  stage: {
    type: String,
    required: true,
    enum: {
      values: ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
      message: '{VALUE} is not a valid stage'
    },
    default: 'New',
    index: true
  },
  source: {
    type: String,
    required: [true, 'Source is required'],
    enum: {
      values: ['Website', 'Referral', 'Social Media', 'Email', 'Phone', 'Other'],
      message: '{VALUE} is not a valid source'
    },
    index: true
  },
  product: {
    type: String,
    required: [true, 'Product is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    index: true
  },
  inquiryDate: {
    type: Date,
    required: [true, 'Inquiry date is required'],
    default: Date.now
  },
  quotationDate: {
    type: Date
  },
  followUp: {
    nextDate: Date,
    notes: String,
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Cancelled'],
      default: 'Pending'
    }
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Converted', 'Lost'],
    default: 'Active',
    index: true
  },
  probability: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: [{
    content: {
      type: String,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: String,
    path: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
leadSchema.index({ createdAt: -1 });
leadSchema.index({ updatedAt: -1 });
leadSchema.index({ 'company': 'text', 'name': 'text', 'product': 'text' });

// Virtual for full customer name
leadSchema.virtual('fullName').get(function() {
  return `${this.name} (${this.company})`;
});

// Pre-save middleware
leadSchema.pre('save', function(next) {
  // Update probability based on stage
  const stageProbabilities = {
    'New': 10,
    'Contacted': 30,
    'Qualified': 50,
    'Proposal': 70,
    'Negotiation': 90,
    'Won': 100,
    'Lost': 0
  };
  this.probability = stageProbabilities[this.stage] || this.probability;
  next();
});

// Static method to find duplicate leads
leadSchema.statics.findDuplicates = async function(lead) {
  return this.find({
    $or: [
      { email: lead.email },
      { phone: lead.phone },
      { 
        $and: [
          { name: lead.name },
          { company: lead.company }
        ]
      }
    ]
  });
};

const Lead = mongoose.model("Lead", leadSchema);
module.exports = Lead;
