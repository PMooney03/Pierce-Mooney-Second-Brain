import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { authMiddleware, signToken } from './auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.js';
import { scheduleBackups } from './backup.js';
import { printSetupStatus } from './setup.js';
import { parseFoodProduct } from './nutrition.js';
import { isValidMedSlot } from './medUtils.js';
import {
  createUser,
  authenticateUser,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  getUserById,
  getMedsForDate,
  toggleMed,
  getMealsForDate,
  getFrequentMeals,
  addMeal,
  updateMeal,
  deleteMeal,
  getHistory,
  getSetting,
  setSetting,
} from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const { user, verificationToken, autoVerified } = createUser({ email, password, displayName });
    if (autoVerified) {
      return res.status(201).json({
        message: 'Dev account ready — you can log in now (email check skipped in development).',
        email: user.email,
        emailSent: false,
        autoVerified: true,
      });
    }
    const emailResult = await sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      token: verificationToken,
    });
    res.status(201).json({
      message: emailResult.sent
        ? 'Check your email to confirm your account before logging in.'
        : 'Email is not configured yet — tap the verification link below to activate your account.',
      email: user.email,
      emailSent: emailResult.sent,
      devLink: emailResult.link ?? undefined,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/auth/verify-email', (req, res) => {
  const token = req.query.token?.trim();
  if (!token) return res.status(400).json({ error: 'Verification token required' });
  try {
    const user = verifyEmail(token);
    res.json({ message: 'Email verified! You can now log in.', user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });
  try {
    const { user, verificationToken } = resendVerification(email);
    const emailResult = await sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      token: verificationToken,
    });
    res.json({
      message: emailResult.sent
        ? 'Verification email sent — check your inbox.'
        : 'Email is not configured yet — tap the verification link below.',
      emailSent: emailResult.sent,
      devLink: emailResult.link ?? undefined,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const user = authenticateUser(email, password);
    const token = signToken(user);
    res.json({ user, token });
  } catch (e) {
    const status = e.code === 'EMAIL_NOT_VERIFIED' ? 403 : 401;
    res.status(status).json({ error: e.message, code: e.code });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

  const result = requestPasswordReset(email);
  if (result) {
    const emailResult = await sendPasswordResetEmail({
      to: result.user.email,
      displayName: result.user.displayName,
      token: result.resetToken,
    });
    res.json({
      message: emailResult.sent
        ? 'If that email is registered, a reset link has been sent.'
        : 'If that email is registered, use the reset link below.',
      emailSent: emailResult.sent,
      devLink: emailResult.link ?? undefined,
    });
    return;
  }

  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token?.trim() || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  try {
    const user = resetPassword(token.trim(), password);
    res.json({ message: 'Password updated! You can now log in.', user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = getUserById(req.user.id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (!user.emailVerified) {
    return res.status(403).json({ error: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' });
  }
  res.json({ user });
});

app.use('/api', authMiddleware);

app.get('/api/meds/:date', (req, res) => {
  res.json(getMedsForDate(req.user.id, req.params.date));
});

app.post('/api/meds', (req, res) => {
  const { date, slot } = req.body;
  if (!date || !isValidMedSlot(slot)) {
    return res.status(400).json({ error: 'Invalid date or slot' });
  }
  const takenAt = toggleMed(req.user.id, date, slot);
  res.json({ slot, takenAt });
});

app.get('/api/meals/frequent', (req, res) => {
  const rows = getFrequentMeals(req.user.id);
  res.json(rows.map((row) => ({
    name: row.name,
    time: row.time,
    freq: row.freq,
    last_date: row.last_date,
    calories: row.calories,
    carbs: row.carbs,
    sugar: row.sugar,
    protein: row.protein,
    fat: row.fat,
    saturatedFat: row.saturated_fat,
    fiber: row.fiber,
    salt: row.salt,
    nutriScore: row.nutri_score,
    servingSize: row.serving_size,
    notes: row.notes,
    per: 'serving',
  })));
});

app.get('/api/meals/:date', (req, res) => {
  res.json(getMealsForDate(req.user.id, req.params.date));
});

app.post('/api/meals', (req, res) => {
  const { date, time, name } = req.body;
  if (!date || !time || !name?.trim()) {
    return res.status(400).json({ error: 'Date, time, and name are required' });
  }
  const meal = addMeal(req.user.id, req.body);
  res.status(201).json(meal);
});

app.put('/api/meals/:id', (req, res) => {
  try {
    const meal = updateMeal(req.user.id, Number(req.params.id), req.body);
    res.json(meal);
  } catch (e) {
    res.status(e.message === 'Meal not found' ? 404 : 400).json({ error: e.message });
  }
});

app.delete('/api/meals/:id', (req, res) => {
  deleteMeal(req.user.id, Number(req.params.id));
  res.json({ ok: true });
});

app.get('/api/history', (req, res) => {
  const days = req.query.days === 'all' ? 0 : Number(req.query.days) || 90;
  res.json(getHistory(req.user.id, days));
});

app.get('/api/settings/:key', (req, res) => {
  res.json({ value: getSetting(req.user.id, req.params.key) });
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  setSetting(req.user.id, key, String(value));
  res.json({ ok: true });
});

app.get('/api/food/search', async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json([]);

  try {
    const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
    url.searchParams.set('search_terms', q);
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    url.searchParams.set('page_size', '10');
    url.searchParams.set('fields', 'product_name,code,nutriments,nutrition_grades,nutriscore_grade,serving_size');

    const response = await fetch(url, {
      headers: { 'User-Agent': 'DiabetesApp/1.0 (family health tracker)' },
    });
    const data = await response.json();
    const products = (data.products ?? []).map((p) => parseFoodProduct(p));
    res.json(products);
  } catch {
    res.status(502).json({ error: 'Food search unavailable' });
  }
});

app.get('/api/food/barcode/:code', async (req, res) => {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v3/product/${req.params.code}?fields=product_name,nutriments,nutrition_grades,nutriscore_grade,serving_size`,
      { headers: { 'User-Agent': 'DiabetesApp/1.0 (family health tracker)' } },
    );
    const data = await response.json();
    if (data.status !== 'success') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(parseFoodProduct(data.product, req.params.code));
  } catch {
    res.status(502).json({ error: 'Barcode lookup unavailable' });
  }
});

const clientDist = join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Build the client first with npm run build' });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const env = process.env.APP_ENV === 'development' ? 'DEV' : 'PROD';
  console.log(`Diabetes Companion [${env}] running on http://localhost:${PORT}`);
  console.log(`Database: ${process.env.DB_FILE || 'diabetes.db'}`);
  scheduleBackups();
  printSetupStatus();
});
