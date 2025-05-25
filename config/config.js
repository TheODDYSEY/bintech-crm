const path = require('path');

// Load environment variables
require('dotenv').config();

const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || 'localhost',
  frontendUrl: process.env.FRONTEND_URL || 'https://bintech-crm.onrender.com',

  // Database
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bintech_crm',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: 3600 // 1 hour default TTL
  },

  // Session
  session: {
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
  },

  // CORS
  cors: {
    origin: process.env.FRONTEND_URL || 'https://bintech-crm.onrender.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token']
  },

  // Security
  security: {
    bcrypt: {
      saltRounds: 12
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'jwt-secret-key-change-in-production',
      expiresIn: '1d'
    },
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    },
    loginRateLimit: {
      windowMs: 60 * 60 * 1000, // 1 hour window
      max: 5 // start blocking after 5 requests
    }
  },

  // File Upload
  upload: {
    directory: path.join(__dirname, '../uploads'),
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['text/csv', 'application/vnd.ms-excel', 'application/json']
  },

  // Logging
  logging: {
    dir: path.join(__dirname, '../logs'),
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
    maxFiles: 5,
    maxSize: '10m'
  },

  // Email (for future implementation)
  email: {
    from: process.env.EMAIL_FROM || 'noreply@bintech-crm.com',
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    }
  },

  // API Versioning
  api: {
    prefix: '/api',
    version: 'v1'
  }
};

module.exports = config;