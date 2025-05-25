# Bintech CRM

A modern, secure, and scalable Customer Relationship Management system built with Node.js, Express, MongoDB, and Redis. This enterprise-grade CRM system offers comprehensive contact and lead management with robust security features.

## 🌟 Features

### Core Features

#### Contact Management
- Create, update, and delete contacts
- Comprehensive contact profiles
- Contact history tracking
- Contact segmentation and tagging
- Bulk contact operations
- Contact deduplication
- Contact import/export (CSV)

#### Lead Management
- Lead capture and tracking
- Custom lead stages
- Lead scoring
- Lead source tracking
- Lead assignment
- Lead conversion tracking
- Lead activity timeline

#### Deal Management
- Deal pipeline visualization
- Deal stage tracking
- Deal value forecasting
- Win/loss probability
- Deal activity logging
- Custom deal fields
- Deal analytics

#### User Management
- Role-based access control
- User activity tracking
- Session management
- Password reset workflow
- Two-factor authentication
- Login attempt monitoring

### Security Features

#### Authentication & Authorization
- Session-based authentication
- JWT token management
- Password hashing with bcrypt
- Role-based permissions
- API key authentication
- Session fixation prevention

#### Data Protection
- CSRF token validation
- XSS prevention
- SQL injection protection
- MongoDB query sanitization
- Input validation (Joi)
- File upload validation
- Sensitive data masking

#### Rate Limiting
- API rate limiting (100 req/15min)
- Login attempt limiting (5/hour)
- Password reset limiting (3/hour)
- IP-based throttling

### Performance Features

#### Caching System
- Redis caching layer
- Cache invalidation strategies
- Cached query results
- Session data caching
- API response caching
- Cache statistics

#### Database Optimization
- Connection pooling
- Indexed queries
- Query optimization
- Bulk operations
- Compound indexes
- Aggregation pipelines

#### Real-time Features
- WebSocket integration
- Live data updates
- Real-time notifications
- Activity streams
- Presence indicators

### Data Management

#### Import/Export
- CSV import/export
- Data validation
- Error handling
- Progress tracking
- Duplicate detection
- Field mapping

#### Backup System
- Automated backups
- Backup scheduling
- Backup verification
- Point-in-time recovery
- Backup rotation

#### Audit System
- User activity logging
- Data change tracking
- Security event logging
- API request logging
- Error logging

## 🚀 Getting Started

### Prerequisites

#### Required Software
- Node.js (>= 18.x)
- MongoDB (>= 5.x)
- Redis (>= 6.x)
- Git

#### System Requirements
- CPU: 2+ cores recommended
- RAM: 4GB minimum
- Storage: 10GB minimum
- OS: Windows/Linux/macOS

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/bintech-crm.git
cd bintech-crm
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Initialize the database:
```bash
npm run db:init
```

5. Start the application:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Environment Variables
```env
# Server Configuration
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/bintech_crm
MONGODB_POOL_SIZE=10

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Security
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h
SESSION_SECRET=your-session-secret
BCRYPT_ROUNDS=12

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
```

## 📁 Project Structure

```
├── config/                 # Configuration files
│   ├── config.js           # Main configuration
│   └── database.js         # Database configuration
├── middleware/             # Express middleware
│   ├── auth.js             # Authentication middleware
│   ├── cache.js            # Redis caching middleware
│   ├── errorHandler.js     # Error handling middleware
│   ├── rateLimiter.js      # Rate limiting middleware
│   └── validation.js       # Request validation middleware
├── models/                 # Mongoose models
│   ├── user.js             # User model
│   ├── contact.js          # Contact model
│   ├── lead.js             # Lead model
│   └── deal.js             # Deal model
├── services/               # Business logic
│   ├── authService.js      # Authentication service
│   ├── contactService.js   # Contact management
│   ├── leadService.js      # Lead management
│   └── dealService.js      # Deal management
├── utils/                  # Utility functions
│   ├── logger.js           # Logging utility
│   ├── security.js         # Security functions
│   ├── validation.js       # Validation schemas
│   └── helpers.js          # Helper functions
├── routes/                 # API routes
├── public/                 # Static files
├── uploads/                # File upload directory
├── logs/                   # Application logs
└── tests/                  # Test files
```

## 🔌 API Documentation

### Authentication Endpoints

#### User Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh-token` - Refresh JWT token
- `POST /api/auth/reset-password-request` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

#### Contact Management
- `GET /api/contacts` - List contacts (with pagination)
- `POST /api/contacts` - Create contact
- `GET /api/contacts/:id` - Get contact details
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact
- `POST /api/contacts/import` - Import contacts (CSV)
- `GET /api/contacts/export` - Export contacts (CSV)
- `GET /api/contacts/search` - Search contacts

#### Lead Management
- `GET /api/leads` - List leads (with pagination)
- `POST /api/leads` - Create lead
- `GET /api/leads/:id` - Get lead details
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead
- `POST /api/leads/import` - Import leads (CSV)
- `GET /api/leads/export` - Export leads (CSV)
- `GET /api/leads/search` - Search leads

#### Deal Management
- `GET /api/deals` - List deals (with pagination)
- `POST /api/deals` - Create deal
- `GET /api/deals/:id` - Get deal details
- `PUT /api/deals/:id` - Update deal
- `DELETE /api/deals/:id` - Delete deal
- `GET /api/deals/pipeline` - Get deal pipeline
- `GET /api/deals/forecast` - Get deal forecast

## 🔒 Security Implementation

### Authentication Flow
1. User submits credentials
2. Server validates input
3. Password checked against bcrypt hash
4. JWT token generated
5. Session created in Redis
6. CSRF token generated
7. Secure cookie set

### Security Measures
- All passwords hashed (bcrypt)
- Sensitive data encrypted
- HTTPS enforced
- Secure session cookies
- CSRF protection
- XSS prevention
- SQL injection protection
- Rate limiting
- Input validation

## 🚀 Performance Optimization

### Caching Strategy
- Contact lists: 5 minutes
- Lead statistics: 15 minutes
- User sessions: 24 hours
- API responses: 1 minute
- Search results: 10 minutes

### Database Optimization
- Indexed fields:
  - Contacts: email, phone
  - Leads: status, source
  - Deals: stage, value
  - Users: email, username

## 📊 Analytics & Reporting

### Available Reports
- Lead conversion rates
- Sales pipeline analysis
- Deal win/loss ratios
- User performance metrics
- Activity reports
- Custom dashboards

### Export Formats
- CSV
- Excel
- PDF
- JSON

## 🔄 Background Jobs

### Scheduled Tasks
- Daily database backup (2 AM)
- Weekly analytics (Monday 1 AM)
- Monthly report generation
- Hourly cache cleanup
- Daily log rotation

## 🧪 Testing

### Test Suites
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep="Auth Tests"

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e
```

### Test Coverage Goals
- Unit Tests: 80%
- Integration Tests: 70%
- E2E Tests: 50%

## 🔧 Development

### Code Style
```bash
# Check code style
npm run lint

# Fix code style
npm run lint:fix

# Format code
npm run format
```

### Debugging
```bash
# Start with debugging
npm run dev:debug

# Debug specific file
node --inspect-brk file.js

# Debug tests
npm run test:debug
```

### Database Commands
```bash
# Initialize database
npm run db:init

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Reset database
npm run db:reset
```

## 📝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### Contribution Guidelines
- Follow code style guidelines
- Add tests for new features
- Update documentation
- Follow commit message conventions
- Review existing issues

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
1. Check documentation
2. Search existing issues
3. Create new issue
4. Contact support team

### Reporting Bugs
- Use issue template
- Include reproduction steps
- Attach error logs
- Specify environment

## 🙏 Acknowledgments

- Express.js - Web framework
- MongoDB - Database
- Redis - Caching
- Winston - Logging
- Jest - Testing
- Contributors

## 📚 Additional Resources

- [API Documentation](docs/api.md)
- [Development Guide](docs/development.md)
- [Deployment Guide](docs/deployment.md)
- [Security Guide](docs/security.md)
- [Contributing Guide](CONTRIBUTING.md)