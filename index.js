const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const morgan = require('morgan');
const { pool } = require('./db');

// Load environment variables
dotenv.config();
 
// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Custom morgan token for request body
morgan.token('body', (req) => JSON.stringify(req.body));
morgan.token('response-time-ms', (req, res) => {
  if (!res._header || !req._startAt) return '';
  const diff = process.hrtime(req._startAt);
  const ms = diff[0] * 1e3 + diff[1] * 1e-6;
  return ms.toFixed(2);
});

// Custom morgan format
const morganFormat = ':remote-addr - :method :url :status :response-time-ms ms - :res[content-length] bytes - :body';

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Development CORS configuration - very permissive
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Allow all origins dynamically
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'], // Allowed headers
  credentials: true, // Allow cookies/credentials to be sent
  maxAge: 86400 // Cache preflight responses for 1 day (optional)
}));

// Only use helmet in production
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));
}

app.use(express.json());
app.use(limiter);

// Add morgan middleware for request logging
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => {
      logger.info(message.trim());
    }
  }
}));

// Import routes
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const moodRoutes = require('./routes/moodRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const profileRoutes = require('./routes/profileRoutes');

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/mood', moodRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to SinagTala API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    message: err.message || 'An unexpected error occurred',
    error: process.env.NODE_ENV === 'development' ? err.stack : 'Internal Server Error'
  });
});

// Start the server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
});