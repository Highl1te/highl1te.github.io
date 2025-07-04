import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables first, before any other imports
// Look for .env file in the project root (two levels up from apps/server)
dotenv.config({ path: path.join(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { initializeDatabase } from './config/database.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Initialize Passport after environment variables are loaded
import passport, { configurePassport } from './config/passport.js';
configurePassport();

import authRoutes from './routes/auth.js';
import marketplaceRoutes from './routes/marketplaceRoute.js';

// Middleware
// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://discord.com", "https://discordapp.com"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
    ];

    // In development, also allow localhost variants
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push(
        'http://localhost:5173',
        'http://10.0.0.2:5173',
        'http://127.0.0.1:5173'
      );
    }

    // In production, also allow the production domain variants
    if (process.env.NODE_ENV === 'production') {
      allowedOrigins.push(
        'https://www.highlite.dev',
        process.env.CORS_ORIGIN || 'https://www.highlite.dev'
      );
    }
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'development' && (
        origin.match(/^http:\/\/10\.0\.0\.\d+:5173$/) ||
        origin.match(/^http:\/\/192\.168\.\d+\.\d+:5173$/) ||
        origin.match(/^http:\/\/172\.16\.\d+\.\d+:5173$/) ||
        origin.match(/^http:\/\/localhost:\d+$/) ||
        origin.match(/^http:\/\/127\.0\.0\.1:\d+$/))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set in production');
    }
    return 'fallback-secret-dev-only';
  })(),
  resave: false,
  saveUninitialized: false,
  name: 'highlite.session',
  cookie: {
    secure: false, // Keep false since we don't have HTTPS working yet
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax', // Keep as lax for now
    domain: undefined
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/marketplace', marketplaceRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
