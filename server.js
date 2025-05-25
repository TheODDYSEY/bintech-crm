// server.js - Complete Node.js CRM Backend with MongoDB
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Database Schemas
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const contactSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    company: String,
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const leadSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    status: {
        type: String,
        enum: ['new', 'contacted', 'qualified', 'proposal', 'closed-won', 'closed-lost'],
        default: 'new'
    },
    source: {
        type: String,
        enum: ['website', 'referral', 'social-media', 'email', 'phone', 'other'],
        default: 'website'
    },
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const salesSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customer: { type: String, required: true },
    amount: { type: Number, required: true },
    product: { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled', 'refunded'],
        default: 'pending'
    },
    date: { type: Date, required: true },
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Models
const User = mongoose.model('User', userSchema);
const Contact = mongoose.model('Contact', contactSchema);
const Lead = mongoose.model('Lead', leadSchema);
const Sale = mongoose.model('Sale', salesSchema);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ error: 'Validation Error', details: errors });
    }
    
    if (err.code === 11000) {
        return res.status(400).json({ error: 'Email already exists' });
    }
    
    res.status(500).json({ error: 'Internal Server Error' });
};

// AUTHENTICATION ROUTES

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// CONTACT ROUTES

// Get all contacts for authenticated user
app.get('/api/contacts', authenticateToken, async (req, res) => {
    try {
        const contacts = await Contact.find({ userId: req.user.userId })
                                   .sort({ createdAt: -1 });
        res.json(contacts);
    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

// Create new contact
app.post('/api/contacts', authenticateToken, async (req, res) => {
    try {
        const { name, email, phone, company, notes } = req.body;

        const contact = new Contact({
            userId: req.user.userId,
            name,
            email,
            phone,
            company,
            notes
        });

        await contact.save();
        res.status(201).json(contact);
    } catch (error) {
        console.error('Create contact error:', error);
        res.status(500).json({ error: 'Failed to create contact' });
    }
});

// Update contact
app.put('/api/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const { name, email, phone, company, notes } = req.body;
        
        const contact = await Contact.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { name, email, phone, company, notes, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!contact) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.json(contact);
    } catch (error) {
        console.error('Update contact error:', error);
        res.status(500).json({ error: 'Failed to update contact' });
    }
});

// Delete contact
app.delete('/api/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const contact = await Contact.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!contact) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({ error: 'Failed to delete contact' });
    }
});

// LEAD ROUTES

// Get all leads for authenticated user
app.get('/api/leads', authenticateToken, async (req, res) => {
    try {
        const leads = await Lead.find({ userId: req.user.userId })
                              .sort({ createdAt: -1 });
        res.json(leads);
    } catch (error) {
        console.error('Get leads error:', error);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
});

// Create new lead
app.post('/api/leads', authenticateToken, async (req, res) => {
    try {
        const { name, email, phone, status, source, notes } = req.body;

        const lead = new Lead({
            userId: req.user.userId,
            name,
            email,
            phone,
            status,
            source,
            notes
        });

        await lead.save();
        res.status(201).json(lead);
    } catch (error) {
        console.error('Create lead error:', error);
        res.status(500).json({ error: 'Failed to create lead' });
    }
});

// Update lead
app.put('/api/leads/:id', authenticateToken, async (req, res) => {
    try {
        const { name, email, phone, status, source, notes } = req.body;
        
        const lead = await Lead.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { name, email, phone, status, source, notes, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json(lead);
    } catch (error) {
        console.error('Update lead error:', error);
        res.status(500).json({ error: 'Failed to update lead' });
    }
});

// Delete lead
app.delete('/api/leads/:id', authenticateToken, async (req, res) => {
    try {
        const lead = await Lead.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        res.json({ message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('Delete lead error:', error);
        res.status(500).json({ error: 'Failed to delete lead' });
    }
});

// SALES ROUTES

// Get all sales for authenticated user
app.get('/api/sales', authenticateToken, async (req, res) => {
    try {
        const sales = await Sale.find({ userId: req.user.userId })
                              .sort({ createdAt: -1 });
        res.json(sales);
    } catch (error) {
        console.error('Get sales error:', error);
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

// Create new sale
app.post('/api/sales', authenticateToken, async (req, res) => {
    try {
        const { customer, amount, product, status, date, notes } = req.body;

        const sale = new Sale({
            userId: req.user.userId,
            customer,
            amount,
            product,
            status,
            date,
            notes
        });

        await sale.save();
        res.status(201).json(sale);
    } catch (error) {
        console.error('Create sale error:', error);
        res.status(500).json({ error: 'Failed to create sale' });
    }
});

// Update sale
app.put('/api/sales/:id', authenticateToken, async (req, res) => {
    try {
        const { customer, amount, product, status, date, notes } = req.body;
        
        const sale = await Sale.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            { customer, amount, product, status, date, notes, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!sale) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        res.json(sale);
    } catch (error) {
        console.error('Update sale error:', error);
        res.status(500).json({ error: 'Failed to update sale' });
    }
});

// Delete sale
app.delete('/api/sales/:id', authenticateToken, async (req, res) => {
    try {
        const sale = await Sale.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!sale) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        res.json({ message: 'Sale deleted successfully' });
    } catch (error) {
        console.error('Delete sale error:', error);
        res.status(500).json({ error: 'Failed to delete sale' });
    }
});

// ANALYTICS ROUTES

// Get dashboard statistics
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const [contactsCount, leadsCount, salesCount, totalRevenue] = await Promise.all([
            Contact.countDocuments({ userId }),
            Lead.countDocuments({ userId }),
            Sale.countDocuments({ userId }),
            Sale.aggregate([
                { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

        // Lead conversion statistics
        const leadStats = await Lead.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Sales by status
        const salesStats = await Sale.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
        ]);

        res.json({
            summary: {
                contacts: contactsCount,
                leads: leadsCount,
                sales: salesCount,
                revenue: revenue
            },
            leadStats,
            salesStats
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// SEARCH ROUTES

// Global search across all entities
app.get('/api/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        const userId = req.user.userId;

        if (!q) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const searchRegex = new RegExp(q, 'i');

        const [contacts, leads, sales] = await Promise.all([
            Contact.find({
                userId,
                $or: [
                    { name: searchRegex },
                    { email: searchRegex },
                    { company: searchRegex }
                ]
            }).limit(10),
            Lead.find({
                userId,
                $or: [
                    { name: searchRegex },
                    { email: searchRegex }
                ]
            }).limit(10),
            Sale.find({
                userId,
                $or: [
                    { customer: searchRegex },
                    { product: searchRegex }
                ]
            }).limit(10)
        ]);

        res.json({
            contacts,
            leads,
            sales
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 CRM Server running on port ${PORT}`);
    console.log(`📊 Dashboard available at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});