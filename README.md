
# BINTECH CRM System

A full-stack Customer Relationship Management (CRM) system built with Node.js, Express, MongoDB, and a modern web interface.

<!-- add video here -->
[watch setup_video.mp4](./setup_video.mp4)


## Features

- **User Authentication**
  - Secure login and registration
  - JWT-based authentication
  - Password encryption with bcrypt

- **Contact Management**
  - Add, edit, and delete contacts
  - Contact details include name, email, phone, company, and notes
  - Search functionality
  - Contact count statistics

- **Lead Management**
  - Lead tracking with status updates
  - Lead source tracking
  - Multiple status options (New, Contacted, Qualified, Proposal, Closed Won/Lost)
  - Lead count statistics

- **Sales Management**
  - Sales tracking with customer information
  - Amount and product tracking
  - Sales status management (Pending, Completed, Cancelled, Refunded)
  - Revenue statistics
  - Date-based tracking

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcryptjs for password hashing
- **API**: RESTful API with CORS support

## Project Structure

```plaintext
├── public/
│   └── index.html      # Frontend single-page application
├── server.js           # Main server file with API endpoints
├── package.json        # Project dependencies and scripts
└── .gitignore         # Git ignore configuration
```

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file with the following variables:
```plaintext
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### Contacts
- `GET /api/contacts` - Get all contacts
- `POST /api/contacts` - Create new contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact

### Leads
- `GET /api/leads` - Get all leads
- `POST /api/leads` - Create new lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead

### Sales
- `GET /api/sales` - Get all sales
- `POST /api/sales` - Create new sale
- `PUT /api/sales/:id` - Update sale
- `DELETE /api/sales/:id` - Delete sale

## Database Models

### User Schema
- name (String, required)
- email (String, required, unique)
- password (String, required)
- createdAt (Date)

### Contact Schema
- userId (ObjectId, required)
- name (String, required)
- email (String, required)
- phone (String)
- company (String)
- notes (String)
- createdAt (Date)
- updatedAt (Date)

### Lead Schema
- userId (ObjectId, required)
- name (String, required)
- email (String, required)
- phone (String)
- status (String, enum)
- source (String, enum)
- notes (String)
- createdAt (Date)
- updatedAt (Date)

### Sale Schema
- userId (ObjectId, required)
- customer (String, required)
- amount (Number, required)
- product (String, required)
- status (String, enum)
- date (Date, required)
- notes (String)
- createdAt (Date)
- updatedAt (Date)

## Frontend Features

- Responsive design with mobile support
- Real-time form validation
- Search functionality for contacts, leads, and sales
- Modal-based forms for data entry
- Dashboard with statistics
- Automatic token-based authentication
- Fallback to localStorage when offline

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CORS enabled
- Protected API routes
- Secure password storage
- Token expiration

## Error Handling

- Comprehensive API error responses
- Frontend error display with alerts
- Form validation
- API fallback mechanisms
- MongoDB connection error handling

## Development Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (placeholder)

## Dependencies

### Production
- express: ^4.18.2
- mongoose: ^7.5.0
- bcryptjs: ^2.4.3
- jsonwebtoken: ^9.0.2
- cors: ^2.8.5
- dotenv: ^16.3.1
