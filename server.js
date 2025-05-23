require('dotenv').config();
const MONGO_URI = process.env.MONGODB_URI;

console.log('🔍 Loaded MONGODB_URI:', MONGO_URI);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3011;

mongoose.connect(MONGO_URI || 'mongodb://localhost:27017/bintech_crm')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
app.use("/api/deals", require("./routes/deals"));
// app.listen(3000, '127.0.0.1', ...) // Removed invalid line
app.listen(3011, () => console.log("Server running on http://localhost:3011"));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: 'uploads/' });

// Models
const Lead = require('./models/leads');
const Contact = require('./models/contacts');
const Deal = require('./models/deals');
const User = require('./models/users');

/* ---------- CONTACTS ---------- */
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find();
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/contacts', async (req, res) => {
  try {
    await Contact.create(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.delete('/api/contacts/:phone', async (req, res) => {
  try {
    const result = await Contact.deleteOne({ phone: req.params.phone });
    if (result.deletedCount === 0) return res.status(404).json({ success: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/import-contacts', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', data => results.push(data))
    .on('end', async () => {
      try {
        await Contact.insertMany(results);
        fs.unlinkSync(req.file.path);
        res.json({ success: true, imported: results.length });
      } catch (err) {
        res.status(500).json({ success: false });
      }
    });
});

app.get('/api/export-contacts', async (req, res) => {
  try {
    const contacts = await Contact.find();
    const csvData = new Parser().parse(contacts);
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvData);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ---------- LEADS ---------- */
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await Lead.find();
    res.json(leads);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/leads', async (req, res) => {
  console.log('🚀 Received lead data:', req.body);
  try {
    await Lead.create(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.delete('/api/leads', async (req, res) => {
  try {
    const result = await Lead.deleteOne({ phone: req.body.phone });
    if (result.deletedCount === 0) return res.status(404).json({ success: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/import-leads', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', data => results.push(data))
    .on('end', async () => {
      try {
        await Lead.insertMany(results);
        fs.unlinkSync(req.file.path);
        res.json({ success: true, imported: results.length });
      } catch (err) {
        res.status(500).json({ success: false });
      }
    });
});

app.get('/api/export-leads', async (req, res) => {
  try {
    const leads = await Lead.find();
    const csvData = new Parser().parse(leads);
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvData);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ---------- DEALS ---------- */
app.get('/api/deals', async (req, res) => {
  try {
    const deals = await Deal.find();
    res.json(deals);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/deals', async (req, res) => {
  try {
    await Deal.create(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.delete('/api/deals', async (req, res) => {
  try {
    const result = await Deal.deleteOne({
      name: req.body.name,
      customer: req.body.customer
    });
    if (result.deletedCount === 0) return res.status(404).json({ success: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/import-deals', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', data => results.push(data))
    .on('end', async () => {
      try {
        await Deal.insertMany(results);
        fs.unlinkSync(req.file.path);
        res.json({ success: true, imported: results.length });
      } catch (err) {
        res.status(500).json({ success: false });
      }
    });
});

app.get('/api/export-deals', async (req, res) => {
  try {
    const deals = await Deal.find();
    const csvData = new Parser().parse(deals);
    res.setHeader('Content-Disposition', 'attachment; filename=deals.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvData);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ---------- USER LOGIN ---------- */
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ---------- REDIRECT ROOT ---------- */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

/* ---------- SERVER ---------- */
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});