import { execSync } from 'child_process';
import { isEmailConfigured } from './email.js';

export const PLACEHOLDER_JWT = 'change-this-to-a-long-random-string';
export const PLACEHOLDER_SMTP_USER = 'your@gmail.com';
export const PLACEHOLDER_SMTP_PASS = 'your-gmail-app-password';

export function detectTailscaleUrl() {
  try {
    const out = execSync('tailscale status --json', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const dns = JSON.parse(out).Self?.DNSName?.replace(/\.$/, '');
    if (dns) return `https://${dns}`;
  } catch {
    // Tailscale not installed or not running
  }
  return null;
}

export function isJwtConfigured() {
  const secret = process.env.JWT_SECRET?.trim();
  return Boolean(secret && secret !== PLACEHOLDER_JWT && secret.length >= 32);
}

export function isAppUrlConfigured() {
  const url = (process.env.APP_URL || '').replace(/\/$/, '');
  if (!url) return false;
  if (url.includes('your-pc-name') || url.includes('tail-xxxxx')) return false;
  return true;
}

export function getSetupStatus() {
  const missing = [];
  if (!isJwtConfigured()) missing.push('JWT_SECRET (run: npm run setup)');
  if (!process.env.SMTP_USER?.trim() || process.env.SMTP_USER === PLACEHOLDER_SMTP_USER) {
    missing.push('SMTP_USER');
  }
  if (!process.env.SMTP_PASS?.trim() || process.env.SMTP_PASS === PLACEHOLDER_SMTP_PASS) {
    missing.push('SMTP_PASS (Gmail app password — one-time setup)');
  }
  if (!isAppUrlConfigured()) {
    missing.push('APP_URL (Tailscale URL for phone verification links)');
  }

  const emailConfigured = isEmailConfigured();
  const registrationOpen = !process.env.ALLOWED_EMAILS?.trim();

  return {
    emailConfigured,
    jwtConfigured: isJwtConfigured(),
    appUrlConfigured: isAppUrlConfigured(),
    appUrl: process.env.APP_URL?.replace(/\/$/, '') || null,
    registrationOpen,
    allowedEmails: process.env.ALLOWED_EMAILS?.trim() || null,
    missing,
    readyForAutomatedVerification: emailConfigured && isJwtConfigured() && isAppUrlConfigured(),
  };
}

export function printSetupStatus() {
  const status = getSetupStatus();
  console.log('\n--- Email verification setup ---');
  console.log(`Automated flow ready: ${status.readyForAutomatedVerification ? 'YES' : 'NO'}`);
  console.log(`Email sending: ${status.emailConfigured ? 'configured' : 'NOT configured'}`);
  console.log(`JWT secret: ${status.jwtConfigured ? 'configured' : 'NOT configured (placeholder)'}`);
  console.log(`APP_URL: ${status.appUrlConfigured ? status.appUrl : 'not set (links use localhost)'}`);

  if (status.registrationOpen) {
    console.log('Registration: any valid email allowed (self-service)');
  } else {
    console.log(`Registration restricted to: ${status.allowedEmails}`);
  }

  if (!status.emailConfigured) {
    console.log('\nOne-time admin setup (do this once, not per user):');
    console.log('  1. Open https://myaccount.google.com/apppasswords');
    console.log('  2. Create an app password for "Mail"');
    console.log('  3. Edit server/.env — set SMTP_PASS to that 16-character password');
    console.log('  4. Restart the server');
    console.log('  Or run: npm run setup');
    if (status.missing.length) {
      console.log(`\nStill missing: ${status.missing.join(', ')}`);
    }
  } else {
    console.log('\nUsers can sign up, receive a verification email, and log in automatically.');
  }
  console.log('---\n');
}
