const mongoose = require('mongoose');
const validator = require('validator');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
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
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    index: true
  },
  position: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    required: [true, 'Source is required'],
    enum: {
      values: ['Website', 'Referral', 'Social Media', 'Email', 'Phone', 'Other'],
      message: '{VALUE} is not a valid source'
    }
  },
  type: {
    type: String,
    enum: ['Customer', 'Prospect', 'Partner', 'Vendor', 'Other'],
    default: 'Prospect'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
    index: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
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
  socialProfiles: {
    linkedin: String,
    twitter: String,
    facebook: String
  },
  lastContactDate: Date,
  tags: [{
    type: String,
    trim: true
  }],
  customFields: {
    type: Map,
    of: String
  },
  relatedDeals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal'
  }],
  relatedLeads: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
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
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
contactSchema.index({ createdAt: -1 });
contactSchema.index({ updatedAt: -1 });
contactSchema.index({ 'company': 'text', 'name': 'text', 'notes.content': 'text' });

// Virtual for full name with company
contactSchema.virtual('fullName').get(function() {
  return `${this.name} (${this.company})`;
});

// Pre-save middleware
contactSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to find duplicate contacts
contactSchema.statics.findDuplicates = async function(contact) {
  return this.find({
    $or: [
      { email: contact.email },
      { phone: contact.phone },
      { 
        $and: [
          { name: contact.name },
          { company: contact.company }
        ]
      }
    ]
  });
};

const Contact = mongoose.model('Contact', contactSchema);
module.exports = Contact;
