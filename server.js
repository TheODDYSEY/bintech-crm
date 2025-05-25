require('dotenv').config();
const MONGO_URI = process.env.MONGODB_URI;

// Import required security packages
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const bcrypt = require('bcrypt');
const session = require('express-session');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection with Connection Pooling
mongoose.connect(MONGO_URI || 'mongodb://localhost:27017/bintech_crm', {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Security Headers
app.use(helmet());

// CORS Configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://bintech-crm.onrender.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token']
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Login Rate Limiting
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // start blocking after 5 requests
  message: 'Too many login attempts from this IP, please try again after an hour'
});
app.use('/api/login', loginLimiter);

// Body Parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Data Sanitization
app.use(mongoSanitize()); // Against NoSQL Injection
app.use(xss()); // Against XSS
app.use(hpp()); // Against HTTP Parameter Pollution

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'super-secret-key-change-in-production',
  name: 'sessionId',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CSRF Protection
app.use(csrf());
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// ✅ DEALS ROUTES (using external file)
app.use("/api/deals", require("./routes/deals"));
app.use("/api/leads", require("./routes/leads"));

const upload = multer({ dest: 'uploads/' });

// Models
const Lead = require('./models/leads');
const Contact = require('./models/contacts');
const User = require('./models/users');

// Authentication Routes
const authMiddleware = require('./middleware/auth');

// Password Reset Request
app.post('/api/reset-password-request', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'No account found with this email address'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // TODO: Send reset email
    // For now, just return the token (in production, send via email)
    res.json({
      success: true,
      message: 'Password reset instructions sent',
      debug: { resetToken } // Remove in production
    });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Failed to process password reset request'
    });
  }
});

// Reset Password
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired reset token'
      });
    }

    // Validate password strength
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
      });
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = passwordHash;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Failed to reset password'
    });
  }
});

// Login Route with Enhanced Security
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Input validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_CREDENTIALS',
        message: 'Username and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ username }).select('+passwordHash +loginAttempts +lockUntil');
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials'
      });
    }

    // Check account lock
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(423).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'Account is temporarily locked. Please try again later'
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      // Increment login attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 3600000; // Lock for 1 hour
        await user.save();
        
        return res.status(423).json({
          success: false,
          code: 'ACCOUNT_LOCKED',
          message: 'Too many failed attempts. Account locked for 1 hour'
        });
      }
      
      await user.save();
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Generate session
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({
          success: false,
          code: 'SESSION_ERROR',
          message: 'Failed to create session'
        });
      }

      req.session.userId = user._id;
      req.session.username = user.username;

      res.json({
        success: true,
        code: 'LOGIN_SUCCESS',
        message: 'Login successful',
        user: {
          username: user.username,
          email: user.email
        }
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred'
    });
  }
});

// Logout Route
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        code: 'LOGOUT_ERROR',
        message: 'Failed to logout'
      });
    }
    res.json({
      success: true,
      code: 'LOGOUT_SUCCESS',
      message: 'Logged out successfully'
    });
  });
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