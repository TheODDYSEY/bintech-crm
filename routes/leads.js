const express = require('express');
const router = express.Router();
const Lead = require('../models/leads');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// GET all leads
router.get('/', async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 }); // Most recent first
    res.json({ success: true, leads });
  } catch (err) {
    console.error('❌ Error fetching leads:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single lead by ID
router.get('/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    res.json({ success: true, lead });
  } catch (err) {
    console.error('❌ Error fetching lead:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create new lead
router.post('/', async (req, res) => {
  console.log('🚀 Received lead data:', req.body);
  try {
    const newLead = await Lead.create(req.body);
    console.log('✅ Lead saved:', newLead);
    res.json({ success: true, lead: newLead });
  } catch (err) {
    console.error('❌ Error saving lead:', err);
    if (err.code === 11000) {
      res.status(400).json({ success: false, error: 'Customer number already exists' });
    } else {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// PUT update lead
router.put('/:id', async (req, res) => {
  try {
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );
    if (!updatedLead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    res.json({ success: true, lead: updatedLead });
  } catch (err) {
    console.error('❌ Error updating lead:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE lead
router.delete('/:id', async (req, res) => {
  try {
    const deletedLead = await Lead.findByIdAndDelete(req.params.id);
    if (!deletedLead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting lead:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE all leads
router.delete('/', async (req, res) => {
  try {
    const result = await Lead.deleteMany({});
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    console.error('❌ Error deleting all leads:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST import leads from CSV
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const results = [];
  const errors = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      // Map CSV headers to model fields
      const leadData = {
        customerNumber: data['Customer Number'] || data.customerNumber,
        customerName: data['Customer Name'] || data.customerName,
        companyName: data['Company Name'] || data.companyName,
        email: data['Email'] || data.email,
        phone: data['Phone'] || data.phone,
        source: data['Source'] || data.source,
        product: data['Product'] || data.product,
        category: data['Category'] || data.category,
        status: data['Status'] || data.status || 'New',
        inquiryDate: data['Inquiry Date'] || data.inquiryDate,
        dueDate: data['Due Date'] || data.dueDate,
        followUp: data['Follow-Up'] || data.followUp,
        remarks: data['Remarks'] || data.remarks
      };
      
      // Basic validation
      if (leadData.customerName && leadData.email) {
        results.push(leadData);
      } else {
        errors.push(`Missing required fields: ${JSON.stringify(data)}`);
      }
    })
    .on('end', async () => {
      try {
        let successCount = 0;
        let errorCount = 0;

        // Insert leads one by one to handle duplicates
        for (const leadData of results) {
          try {
            await Lead.create(leadData);
            successCount++;
          } catch (err) {
            errorCount++;
            console.warn(`❌ Error inserting lead: ${err.message}`);
          }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({ 
          success: true, 
          imported: successCount,
          errors: errorCount,
          total: results.length 
        });
      } catch (err) {
        console.error('❌ Error importing leads:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    })
    .on('error', (err) => {
      console.error('❌ CSV parsing error:', err);
      res.status(500).json({ success: false, error: 'Error parsing CSV file' });
    });
});

// GET export leads to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const leads = await Lead.find().lean(); // Use lean() for better performance
    
    if (leads.length === 0) {
      return res.status(404).json({ success: false, message: 'No leads to export' });
    }

    // Map data for CSV export
    const csvData = leads.map(lead => ({
      'Customer Number': lead.customerNumber,
      'Customer Name': lead.customerName,
      'Company Name': lead.companyName,
      'Email': lead.email,
      'Phone': lead.phone,
      'Source': lead.source,
      'Product': lead.product,
      'Category': lead.category,
      'Status': lead.status,
      'Inquiry Date': lead.inquiryDate,
      'Due Date': lead.dueDate,
      'Follow-Up': lead.followUp,
      'Remarks': lead.remarks
    }));

    const parser = new Parser();
    const csv = parser.parse(csvData);
    
    const filename = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  } catch (err) {
    console.error('❌ Error exporting leads:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
