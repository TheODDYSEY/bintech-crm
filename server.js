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
const PORT = process.env.PORT || 3000; // ✅ Fixed: Use Render's PORT

mongoose.connect(MONGO_URI || 'mongodb://localhost:27017/bintech_crm')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ✅ MIDDLEWARE FIRST - SINGLE CORS CONFIGURATION
app.use(cors({
  origin: 'https://bintech-crm.onrender.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ✅ DEALS ROUTES (using external file)
app.use("/api/deals", require("./routes/deals"));
app.use("/api/leads", require("./routes/leads"));

const upload = multer({ dest: 'uploads/' });

// Models
const Lead = require('./models/leads');
const Contact = require('./models/contacts');
const User = require('./models/users');

/* ---------- LOGIN ROUTE - ADDED! ---------- */
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('🔐 Login attempt for:', username);
    
    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    console.log('✅ Login successful for:', username);
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: { username: user.username, email: user.email }
    });
    
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ---------- CONTACTS ---------- */
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find();
    res.json(contacts);
  } catch (err) {
    console.error('❌ Error fetching contacts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/contacts', async (req, res) => {
  console.log('🚀 Received contact data:', req.body);
  try {
    const newContact = await Contact.create(req.body);
    console.log('✅ Contact saved:', newContact);
    res.json({ success: true, contact: newContact });
  } catch (err) {
    console.error('❌ Error saving contact:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/contacts/:phone', async (req, res) => {
  try {
    const result = await Contact.deleteOne({ phone: req.params.phone });
    if (result.deletedCount === 0) return res.status(404).json({ success: false });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error deleting contact:', err);
    res.status(500).json({ success: false, error: err.message });
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
        console.error('❌ Error importing contacts:', err);
        res.status(500).json({ success: false, error: err.message });
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
    console.error('❌ Error exporting contacts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- LEADS ---------- */
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await Lead.find();
    res.json(leads);
  } catch (err) {
    console.error('❌ Error fetching leads:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/leads', async (req, res) => {
  console.log('🚀 Received lead data:', req.body);
  try {
    const newLead = await Lead.create(req.body);
    console.log('✅ Lead saved:', newLead);
    res.json({ success: true, lead: newLead });
  } catch (err) {
    console.error('❌ Error saving lead:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/leads', async (req, res) => {
  try {
    const result = await Lead.deleteOne({ phone: req.body.phone });
    if (result.deletedCount === 0) return res.status(404).json({ success: false });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error deleting lead:', err);
    res.status(500).json({ success: false, error: err.message });
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
        console.error('❌ Error importing leads:', err);
        res.status(500).json({ success: false, error: err.message });
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
    console.error('❌ Error exporting leads:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/seed-user", async (req, res) => {
  try {
    const existing = await User.findOne({ username: "bintechadmin" });
    if (existing) return res.json({ success: true, message: "User already exists" });

    const passwordHash = await bcrypt.hash("Bintech56", 10);
    const newUser = new User({
      username: "bintechadmin",
      email: "admin@bintech.co.ke",
      passwordHash,
    });

    await newUser.save();
    res.json({ success: true, message: "User created" });
  } catch (err) {
    console.error("Seed error:", err);
    res.status(500).json({ success: false, message: "Failed to seed user" });
  }
});

/* ---------- REDIRECT ROOT ---------- */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

/* ---------- SERVER ---------- */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});