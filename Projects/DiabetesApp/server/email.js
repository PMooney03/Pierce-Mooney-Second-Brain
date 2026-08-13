import nodemailer from 'nodemailer';

const PLACEHOLDER_APP_URLS = new Set([
  'https://your-pc-name.tail-xxxxx.ts.net',
  'http://localhost:5173',
]);

function getAppUrl() {
  // Dev always uses the Vite URL so verification links hit the playground, not prod Tailscale
  if (process.env.APP_ENV === 'development') {
    return 'http://localhost:5173';
  }
  const url = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
  if (PLACEHOLDER_APP_URLS.has(url) || url.includes('your-pc-name')) {
    return 'http://localhost:5173';
  }
  return url;
}

const PLACEHOLDER_VALUES = new Set([
  'your@gmail.com',
  'your-gmail-app-password',
  'change-this-to-a-long-random-string',
]);

function smtpConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'health-tracker@localhost',
  };
}

function hasRealSmtpCredentials() {
  const { host, user, pass } = smtpConfig();
  if (!host || !user || !pass) return false;
  if (PLACEHOLDER_VALUES.has(user) || PLACEHOLDER_VALUES.has(pass)) return false;
  return true;
}

function getTransport() {
  if (!hasRealSmtpCredentials()) return null;
  const { host, port, user, pass } = smtpConfig();
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function buildVerificationLink(token) {
  return `${getAppUrl()}/?verify=${encodeURIComponent(token)}`;
}

export function buildResetLink(token) {
  return `${getAppUrl()}/?reset=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail({ to, displayName, token }) {
  const link = buildVerificationLink(token);
  const subject = 'Confirm your Health Tracker account';
  const text = `Hi ${displayName},\n\nTap this link to confirm your email and activate your account:\n\n${link}\n\nThis link expires in 24 hours.\n\nIf you did not sign up, ignore this email.`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#0d9488">Health Tracker</h2>
      <p>Hi ${displayName},</p>
      <p>Please confirm your email address to activate your account:</p>
      <p><a href="${link}" style="display:inline-block;background:#0d9488;color:white;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:bold">Confirm email</a></p>
      <p style="color:#666;font-size:14px">Or copy this link:<br>${link}</p>
      <p style="color:#666;font-size:14px">Link expires in 24 hours.</p>
    </div>
  `;

  const transport = getTransport();
  if (!transport) {
    console.log('\n--- EMAIL NOT CONFIGURED — verification link ---');
    console.log(`To: ${to}`);
    console.log(`Link: ${link}\n`);
    return { sent: false, link };
  }

  try {
    await transport.sendMail({ from: smtpConfig().from, to, subject, text, html });
    return { sent: true, link: null };
  } catch (err) {
    console.warn('Email send failed — printing verification link instead:', err.message);
    console.log('\n--- VERIFICATION LINK (email failed) ---');
    console.log(`To: ${to}`);
    console.log(`Link: ${link}\n`);
    return { sent: false, link };
  }
}

export function isEmailConfigured() {
  return hasRealSmtpCredentials();
}

export async function sendPasswordResetEmail({ to, displayName, token }) {
  const link = buildResetLink(token);
  const subject = 'Reset your Health Tracker password';
  const text = `Hi ${displayName},\n\nTap this link to reset your password:\n\n${link}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#0d9488">Health Tracker</h2>
      <p>Hi ${displayName},</p>
      <p>Tap below to choose a new password:</p>
      <p><a href="${link}" style="display:inline-block;background:#0d9488;color:white;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:bold">Reset password</a></p>
      <p style="color:#666;font-size:14px">Or copy this link:<br>${link}</p>
      <p style="color:#666;font-size:14px">Link expires in 1 hour.</p>
    </div>
  `;

  const transport = getTransport();
  if (!transport) {
    console.log('\n--- EMAIL NOT CONFIGURED — password reset link ---');
    console.log(`To: ${to}`);
    console.log(`Link: ${link}\n`);
    return { sent: false, link };
  }

  try {
    await transport.sendMail({ from: smtpConfig().from, to, subject, text, html });
    return { sent: true, link: null };
  } catch (err) {
    console.warn('Password reset email failed:', err.message);
    console.log(`Link: ${link}\n`);
    return { sent: false, link };
  }
}
