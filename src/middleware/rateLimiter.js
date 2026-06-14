import rateLimit from 'express-rate-limit';

export const connectivityTestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Too many connectivity test requests. Please retry in a minute.',
  },
});

