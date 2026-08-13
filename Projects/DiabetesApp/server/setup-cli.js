import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import {
  detectTailscaleUrl,
  PLACEHOLDER_JWT,
  PLACEHOLDER_SMTP_PASS,
  PLACEHOLDER_SMTP_USER,
  printSetupStatus,
} from './setup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
const examplePath = join(__dirname, '.env.example');

function setEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, line);
  return `${content.trimEnd()}\n${line}\n`;
}

function getEnvValue(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match?.[1]?.trim() ?? '';
}

if (!existsSync(envPath)) {
  if (existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
    console.log('Created server/.env from .env.example');
  } else {
    console.error('No server/.env or .env.example found.');
    process.exit(1);
  }
}

let env = readFileSync(envPath, 'utf8');
let changed = false;

const jwt = getEnvValue(env, 'JWT_SECRET');
if (!jwt || jwt === PLACEHOLDER_JWT || jwt.length < 32) {
  const newSecret = crypto.randomBytes(48).toString('base64url');
  env = setEnvValue(env, 'JWT_SECRET', newSecret);
  console.log('Generated JWT_SECRET');
  changed = true;
}

const tailscaleUrl = detectTailscaleUrl();
const appUrl = getEnvValue(env, 'APP_URL');
if (tailscaleUrl && (!appUrl || appUrl.includes('your-pc-name') || appUrl.includes('tail-xxxxx'))) {
  env = setEnvValue(env, 'APP_URL', tailscaleUrl);
  console.log(`Set APP_URL=${tailscaleUrl}`);
  changed = true;
} else if (!appUrl || appUrl.includes('your-pc-name')) {
  console.log('Tailscale not detected — APP_URL left as localhost for local dev.');
  console.log('After running "tailscale serve 3001", set APP_URL to your https://....ts.net URL.');
}

const smtpUser = getEnvValue(env, 'SMTP_USER');
if (!smtpUser || smtpUser === PLACEHOLDER_SMTP_USER) {
  env = setEnvValue(env, 'SMTP_USER', 'piercemooney7@gmail.com');
  env = setEnvValue(env, 'EMAIL_FROM', 'piercemooney7@gmail.com');
  console.log('Set SMTP_USER and EMAIL_FROM to piercemooney7@gmail.com');
  changed = true;
}

const smtpPass = getEnvValue(env, 'SMTP_PASS');
if (!smtpPass || smtpPass === PLACEHOLDER_SMTP_PASS) {
  console.log('\n--- ACTION REQUIRED (one time only) ---');
  console.log('Add your Gmail app password to server/.env:');
  console.log('  1. Go to https://myaccount.google.com/apppasswords');
  console.log('     (Enable 2-Step Verification first if prompted)');
  console.log('  2. Create an app password for "Mail" / "Other (Health Tracker)"');
  console.log('  3. Edit server/.env and replace SMTP_PASS=your-gmail-app-password');
  console.log('  4. Restart the server');
  console.log('\nAfter this, every new user gets a real verification email automatically.');
  console.log('You do NOT need to add emails manually unless you enable ALLOWED_EMAILS.\n');
}

if (changed) {
  writeFileSync(envPath, env, 'utf8');
  console.log('Saved server/.env');
} else {
  console.log('server/.env already looks configured — nothing to change.');
}

loadEnv({ path: envPath, override: true });
printSetupStatus();
