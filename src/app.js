import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import connectivityRoutes from './routes/connectivity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FRONTEND_DIR = join(__dirname, '..', 'frontend', 'dist');
const HAS_FRONTEND = existsSync(join(FRONTEND_DIR, 'index.html'));

const app = express();

function splitCsv(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUri(value, fallback) {
  const source = value || fallback;
  return source.endsWith('/') ? source.slice(0, -1) : source;
}

const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv === undefined || trustProxyEnv === '') {
  app.set('trust proxy', 2);
} else if (trustProxyEnv === 'true') {
  app.set('trust proxy', true);
} else if (trustProxyEnv === 'false') {
  app.set('trust proxy', false);
} else {
  const parsedTrustProxy = Number(trustProxyEnv);
  app.set('trust proxy', Number.isInteger(parsedTrustProxy) ? parsedTrustProxy : 2);
}

app.use(compression({ enforceEncoding: 'gzip' }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [],
  }),
);

app.use(express.json({ limit: '10mb' }));

// API rate limiter
const apiLimiter = rateLimit({
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.API_RATE_LIMIT_MAX || 1000),
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Debug IP
app.get('/debug', (req, res) => {
  res.status(200).json({
    ip: req.ip,
    xff: req.headers['x-forwarded-for'] || null,
    trustProxy: app.get('trust proxy'),
  });
});

app.use('/api', apiLimiter);

// Mount API route modules
app.use(connectivityRoutes);

// Error handler for oversized payloads
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({
      ok: false,
      error: 'Request body too large',
    });
  }
  return next(err);
});

// Serve frontend static files if available
if (HAS_FRONTEND) {
  app.use(express.static(FRONTEND_DIR));

  app.get('/{*splat}', (req, res) => {
    res.sendFile(join(FRONTEND_DIR, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('PostgreSQL Connectivity Helper service is running. Frontend not built yet.');
  });
}

export default app;
