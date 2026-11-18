const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'greenloop-dev-secret-change-me';
const COOKIE = 'gl_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function hashPassword(password) {
  return bcrypt.hashSync(String(password), 10);
}

function verifyPassword(password, hash) {
  try {
    return bcrypt.compareSync(String(password), String(hash || ''));
  } catch {
    return false;
  }
}

function signSession(user) {
  return jwt.sign(user, SECRET, { expiresIn: MAX_AGE });
}

function readSession(req) {
  const raw = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return null;
  const token = decodeURIComponent(raw.slice(COOKIE.length + 1));
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

const SECURE = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '';

function setSessionCookie(res, user) {
  const token = signSession(user);
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${SECURE}; Max-Age=${MAX_AGE}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax${SECURE}; Max-Age=0`
  );
}

function requireRole(req, res, role) {
  const user = readSession(req);
  if (!user || user.role !== role) {
    res.status(401).json({ success: false, message: 'You are not authorised to perform this action.' });
    return null;
  }
  return user;
}

module.exports = {
  hashPassword,
  verifyPassword,
  readSession,
  setSessionCookie,
  clearSessionCookie,
  requireRole,
  COOKIE
};
