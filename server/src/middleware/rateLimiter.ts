import jwt from 'jsonwebtoken';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_testcase_ai_2026';

function getUserIdFromToken(req: any): string | null {
  try {
    const authHeader = req.headers?.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded?.id || decoded?.userId || null;
  } catch {
    return null;
  }
}

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path.startsWith('/api/health') ||
    req.path.startsWith('/api/setup') ||
    req.path === '/api/health/deep',
  keyGenerator: (req) => {
    const userId = getUserIdFromToken(req);
    return userId || ipKeyGenerator(req.ip || '127.0.0.1') || 'anonymous';
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/health'),
  keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1') || 'anonymous',
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  message: { message: 'AI generation limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/health') || getUserIdFromToken(req) !== null,
});

export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { message: 'Export limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/health') || getUserIdFromToken(req) !== null,
});
