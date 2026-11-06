import crypto from 'node:crypto';

const COOKIE = 'evalook_session';
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRIES = 8;
const attempts = new Map();

function password() {
  return process.env.EVALOOK_PASSWORD || '';
}

export function passwordRequired() {
  return password().length > 0;
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

function sessionToken() {
  return crypto.createHmac('sha256', password()).update('evalook-v1').digest('hex');
}

function readCookie(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === COOKIE) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function clientKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'local';
}

function tooMany(req) {
  const now = Date.now();
  const key = clientKey(req);
  const bucket = attempts.get(key) || [];
  const recent = bucket.filter((time) => now - time < WINDOW_MS);
  attempts.set(key, recent);
  return recent.length >= MAX_TRIES;
}

function noteFailure(req) {
  const key = clientKey(req);
  const bucket = attempts.get(key) || [];
  bucket.push(Date.now());
  attempts.set(key, bucket);
}

export function sessionStatus(req) {
  if (!passwordRequired()) return { required: false, ok: true };
  const got = readCookie(req);
  const expected = sessionToken();
  const same = got.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  return { required: true, ok: same };
}

export function login(value, req) {
  if (!passwordRequired()) return '';
  if (tooMany(req)) {
    const error = new Error('Demasiados intentos. Espera unos minutos.');
    error.status = 429;
    throw error;
  }
  const matches = crypto.timingSafeEqual(digest(value || ''), digest(password()));
  if (!matches) {
    noteFailure(req);
    const error = new Error('Clave incorrecta.');
    error.status = 401;
    throw error;
  }
  attempts.delete(clientKey(req));
  return sessionToken();
}

function cookie(value, req, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.EVALOOK_SECURE === '1';
  const parts = [
    `${COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function setSessionCookie(res, value, req) {
  if (!passwordRequired()) return;
  res.setHeader('Set-Cookie', cookie(value, req, 60 * 60 * 24 * 14));
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function authGate(req, res, next) {
  if (!passwordRequired() || !req.path.startsWith('/api')) return next();
  if (req.path === '/api/health' || req.path === '/api/session' || req.path === '/api/login') return next();
  if (sessionStatus(req).ok) return next();
  res.status(401).json({ error: 'Entra con la clave del inventario.' });
}
