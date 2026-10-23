import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import multer from 'multer';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import { requireAuth } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

// Route imports
import authRoutes from './routes/auth.routes.js';
import ideasRoutes from './routes/ideas.routes.js';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import userRoutes from './routes/user.routes.js';
import reportRoutes from './routes/report.routes.js';

export const app = express();

// Security middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", env.CLIENT_URL, 'https:', 'http:'].filter(Boolean)
    }
  }
}));

const allowedOrigins = [
  env.CLIENT_URL,
  env.CLIENT_URL ? env.CLIENT_URL.replace(/\/$/, '') : null,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = origin.replace(/\/$/, '');

    // Check if explicitly listed in allowedOrigins
    const isExplicit = allowedOrigins.some(allowed => cleanOrigin === allowed.replace(/\/$/, ''));

    // Automatically allow deployments on onrender.com, vercel.app, railway.app, or local dev
    const isCloudHost = /https?:\/\/.*?\.(onrender\.com|vercel\.app|railway\.app|pages\.dev)(:\d+)?$/.test(cleanOrigin);
    const isLocalhost = /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin);

    if (isExplicit || isCloudHost || isLocalhost) {
      return callback(null, true);
    }

    // Do not set CORS headers for unauthorized origins
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing & cookies
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Request logging in non-test env
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Global API Rate Limiter
app.use('/api', apiLimiter);

// Multer upload config for cover images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.'));
    }
  }
});

// Health check endpoints
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// File upload endpoint (cover images)
app.post('/api/v1/upload', requireAuth, upload.single('cover'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: { message: 'No file uploaded.' }
    });
  }

  // Simulated asset URL or data URL
  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  res.json({
    success: true,
    data: {
      url: base64,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    }
  });
});

// API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/ideas', ideasRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/reports', reportRoutes);

// In production or when client/dist exists, serve frontend static assets & SPA fallback
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // SPA fallback for all GET requests not matching API routes or /health
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Catch-all 404 & error handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
