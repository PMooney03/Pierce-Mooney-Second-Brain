import crypto from 'crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return EMAIL_RE.test(email.trim());
}

export function isEmailAllowed(email) {
  const allowed = process.env.ALLOWED_EMAILS?.trim();
  if (!allowed) return true;
  const list = allowed.split(',').map((e) => e.trim().toLowerCase());
  return list.includes(email.trim().toLowerCase());
}

export function createVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function verificationExpiry() {
  const d = new Date();
  d.setHours(d.getHours() + 24);
  return d.toISOString();
}

export function resetExpiry() {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}
