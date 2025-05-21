const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const bcrypt = require('bcrypt');


const app = express();
const PORT = 3000;

// === Paths ===
const DATA_DIR = path.join(__dirname, 'data');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const DEALS_FILE = path.join(DATA_DIR, 'deals.json');

// === Ensure folders & files exist ===
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(CONTACTS_FILE)) fs.writeFileSync(CONTACTS_FILE, '[]');
if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]');
if (!fs.existsSync(DEALS_FILE)) fs.writeFileSync(DEALS_FILE, '[]');

// === Middleware ===
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === Utility Functions ===
function readJSON(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data || '[]');
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// === Multer for CSV Upload ===
const upload = multer({ dest: 'uploads/' });

/* ------------------- CONTACTS ENDPOINTS ------------------- */
app.get('/api/contacts', (req, res) => {
  try {
    const contacts = readJSON(CONTACTS_FILE);
    res.json(contacts);
  } catch (err) {
    console.error('Error reading contacts:', err);
    res.status(500).json({ success: false });
  }
});

app.post('/api/contacts', (req, res) => {
  try {
    const newContact = req.body;
    const contacts = readJSON(CONTACTS_FILE);
    contacts.push(newContact);
    writeJSON(CONTACTS_FILE, contacts);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving contact:', err);
    res.status(500).json({ success: false });
  }
});

app.delete('/api/contacts/:phone', (req, res) => {
  try {
    const phone = req.params.phone;
    const contacts = readJSON(CONTACTS_FILE);
    const updated = contacts.filter(c => c.phone !== phone);
    if (updated.length === contacts.length) return res.status(404).json({ success: false });
    writeJSON(CONTACTS_FILE, updated);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting contact:', err);
    res.status(500).json({ success: false });
  }
});

app.post('/api/import-contacts', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', data => results.push(data))
    .on('end', () => {
      try {
        const existing = readJSON(CONTACTS_FILE);
        writeJSON(CONTACTS_FILE, [...existing, ...results]);
        fs.unlinkSync(req.file.path);
        res.json({ success: true, imported: results.length });
      } catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ success: false });
      }
    });
});

app.get('/api/export-contacts', (req, res) => {
  try {
    const contacts = readJSON(CONTACTS_FILE);
    const csvData = new Parser().parse(contacts);
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvData);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false });
  }
});

/* ------------------- LEADS ENDPOINTS ------------------- */
app.get('/api/leads', (req, res) => {
  try {
    const leads = readJSON(LEADS_FILE);
    res.json(leads);
  } catch (err) {
    console.error('Error reading leads:', err);
    res.status(500).json({ success: false });
  }
});

app.post('/api/leads', (req, res) => {
  try {
    const newLead = req.body;
    const leads = readJSON(LEADS_FILE);
    leads.push(newLead);
    writeJSON(LEADS_FILE, leads);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving lead:', err);
    res.status(500).json({ success: false });
  }
});

app.delete('/api/leads', (req, res) => {
  try {
    const { phone } = req.body;
    const leads = readJSON(LEADS_FILE);
    const updated = leads.filter(l => l.phone !== phone);
    if (updated.length === leads.length) return res.status(404).json({ success: false });
    writeJSON(LEADS_FILE, updated);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting lead:', err);
    res.status(500).json({ success: false });
  }
});

app.post('/api/import-leads', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', data => results.push(data))
    .on('end', () => {
      try {
        const existing = readJSON(LEADS_FILE);
        writeJSON(LEADS_FILE, [...existing, ...results]);
        fs.unlinkSync(req.file.path);
        res.json({ success: true, imported: results.length });
      } catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ success: false });
      }
    });
});

app.get('/api/export-leads', (req, res) => {
  try {
    const leads = readJSON(LEADS_FILE);
    const csvData = new Parser().parse(leads);
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvData);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false });
  }
});

/* ------------------- DEALS ENDPOINTS ------------------- */
app.get('/api/deals', (req, res) => {
  try {
    const deals = readJSON(DEALS_FILE);
    res.json(deals);
  } catch (err) {
    console.error('Error reading deals:', err);
    res.status(500).json({ success: false });
  }
});

app.post('/api/deals', (req, res) => {
  try {
    const newDeal = req.body;
    const deals = readJSON(DEALS_FILE);
    deals.push(newDeal);
    writeJSON(DEALS_FILE, deals);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving deal:', err);
    res.status(500).json({ success: false });
  }
});

app.delete('/api/deals', (req, res) => {
  try {
    const { name, customer } = req.body;
    const deals = readJSON(DEALS_FILE);
    const updated = deals.filter(d => d.name !== name || d.customer !== customer);
    if (updated.length === deals.length) return res.status(404).json({ success: false });
    writeJSON(DEALS_FILE, updated);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting deal:', err);
    res.status(500).json({ success: false });
  }
});

app.post('/api/import-deals', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', data => results.push(data))
    .on('end', () => {
      try {
        const existing = readJSON(DEALS_FILE);
        writeJSON(DEALS_FILE, [...existing, ...results]);
        fs.unlinkSync(req.file.path);
        res.json({ success: true, imported: results.length });
      } catch (err) {
        console.error('Import error:', err);
        res.status(500).json({ success: false });
      }
    });
});

app.get('/api/export-deals', (req, res) => {
  try {
    const deals = readJSON(DEALS_FILE);
    const csvData = new Parser().parse(deals);
    res.setHeader('Content-Disposition', 'attachment; filename=deals.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csvData);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false });
  }
});
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const users = readJSON(USERS_FILE);
    const user = users.find(
      u => u.username === username || u.email === username
    );

    if (!user) return res.status(401).json({ success: false, message: 'Invalid username or password' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid username or password' });

    return res.json({ success: true });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


/* ------------------- SERVER START ------------------- */
// === Redirect root to login page ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
/* ------------------- ANALYTICS ENDPOINT ------------------- */
app.get('/api/analytics', (req, res) => {
  try {
    const leads = readJSON(LEADS_FILE);
    const contacts = readJSON(CONTACTS_FILE);
    const deals = readJSON(DEALS_FILE);

    const totalLeads = leads.length;
    const totalContacts = contacts.length;
    const totalDeals = deals.length;

    const wonDeals = deals.filter(d => d.status?.toLowerCase() === 'won');
    const lostDeals = deals.filter(d => d.status?.toLowerCase() === 'lost');

    const conversionRate = totalLeads ? ((wonDeals.length / totalLeads) * 100).toFixed(2) : '0.00';

    // Deals won/lost per month
    const wonPerMonth = {};
    const lostPerMonth = {};

    deals.forEach(deal => {
      const date = new Date(deal.date || deal.createdAt || Date.now());
      const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

      if (deal.status?.toLowerCase() === 'won') {
        wonPerMonth[month] = (wonPerMonth[month] || 0) + 1;
      } else if (deal.status?.toLowerCase() === 'lost') {
        lostPerMonth[month] = (lostPerMonth[month] || 0) + 1;
      }
    });

    // Recent activity (last 5 leads/deals/contacts combined by date)
    const combined = [
      ...leads.map(l => ({ type: 'lead', ...l })),
      ...contacts.map(c => ({ type: 'contact', ...c })),
      ...deals.map(d => ({ type: 'deal', ...d })),
    ];

    const recentActivity = combined
      .filter(item => item.date || item.createdAt)
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
      .slice(0, 5);

    res.json({
      totalLeads,
      totalContacts,
      totalDeals,
      conversionRate,
      wonPerMonth,
      lostPerMonth,
      recentActivity,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false });
  }
});
