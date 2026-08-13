import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createVerificationToken, isEmailAllowed, isValidEmail, resetExpiry, verificationExpiry } from './emailUtils.js';
import { MED_SLOTS } from './medUtils.js';

const MED_SLOT_SQL = MED_SLOTS.map((s) => `'${s}'`).join(', ');

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.DB_FILE || 'diabetes.db';
const db = new DatabaseSync(join(__dirname, dbFile));
console.log(`SQLite database: ${dbFile}`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS medications (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    slot TEXT NOT NULL CHECK(slot IN ('morning', 'evening')),
    taken_at TEXT,
    PRIMARY KEY (user_id, date, slot),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    name TEXT NOT NULL,
    carbs REAL,
    sugar REAL,
    calories REAL,
    protein REAL,
    fat REAL,
    saturated_fat REAL,
    fiber REAL,
    salt REAL,
    nutri_score TEXT,
    serving_size TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function migrateLegacyTables() {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);

  if (tables.includes('medications') && !columnExists('medications', 'user_id')) {
    db.exec('ALTER TABLE medications RENAME TO medications_legacy');
  }
  if (tables.includes('meals') && !columnExists('meals', 'user_id')) {
    db.exec('ALTER TABLE meals RENAME TO meals_legacy');
  }
  if (tables.includes('settings') && !columnExists('settings', 'user_id')) {
    db.exec('ALTER TABLE settings RENAME TO settings_legacy');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS medications (
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      slot TEXT NOT NULL CHECK(slot IN ('morning', 'evening')),
      taken_at TEXT,
      PRIMARY KEY (user_id, date, slot),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      name TEXT NOT NULL,
      carbs REAL,
      sugar REAL,
      calories REAL,
      protein REAL,
      fat REAL,
      saturated_fat REAL,
      fiber REAL,
      salt REAL,
      nutri_score TEXT,
      serving_size TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const mealColumns = columnExists('meals', 'protein') ? [] : [
    ['protein', 'REAL'], ['fat', 'REAL'], ['saturated_fat', 'REAL'],
    ['fiber', 'REAL'], ['salt', 'REAL'], ['nutri_score', 'TEXT'], ['serving_size', 'TEXT'],
  ];
  for (const [col, type] of mealColumns) {
    if (!columnExists('meals', col)) db.exec(`ALTER TABLE meals ADD COLUMN ${col} ${type}`);
  }
}

function columnExists(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

migrateLegacyTables();
migrateBpMedSlot();

function migrateBpMedSlot() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='medications'").get();
  if (!row?.sql?.includes("'bp'")) {
    db.exec(`
      CREATE TABLE medications_new (
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        slot TEXT NOT NULL CHECK(slot IN (${MED_SLOT_SQL})),
        taken_at TEXT,
        PRIMARY KEY (user_id, date, slot),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      INSERT INTO medications_new SELECT * FROM medications;
      DROP TABLE medications;
      ALTER TABLE medications_new RENAME TO medications;
    `);
  }
}

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userColumns.includes('email_verified')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
  db.exec('ALTER TABLE users ADD COLUMN verification_token TEXT');
  db.exec('ALTER TABLE users ADD COLUMN verification_expires TEXT');
  db.exec('UPDATE users SET email_verified = 1 WHERE verification_token IS NULL');
}
const userColumnsAfter = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userColumnsAfter.includes('reset_token')) {
  db.exec('ALTER TABLE users ADD COLUMN reset_token TEXT');
  db.exec('ALTER TABLE users ADD COLUMN reset_expires TEXT');
}

// Dev playground: auto-verify any pending accounts so login works without Tailscale email links
if (process.env.APP_ENV === 'development') {
  const pending = db.prepare('SELECT COUNT(*) AS n FROM users WHERE email_verified = 0').get().n;
  if (pending > 0) {
    db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE email_verified = 0').run();
    console.log(`Dev: auto-verified ${pending} pending account(s)`);
  }
}

export function createUser({ email, password, displayName }) {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) {
    throw new Error('Please enter a valid email address');
  }
  if (!isEmailAllowed(normalized)) {
    throw new Error('This email is not authorised to register. Contact the family admin.');
  }

  const existing = db.prepare('SELECT id, email_verified FROM users WHERE email = ?').get(normalized);
  if (existing?.email_verified) {
    throw new Error('An account with this email already exists');
  }
  if (existing && !existing.email_verified) {
    db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const name = displayName?.trim() || normalized.split('@')[0];
  const token = createVerificationToken();
  const expires = verificationExpiry();
  const autoVerify = process.env.APP_ENV === 'development';

  const result = db.prepare(`
    INSERT INTO users (email, password_hash, display_name, email_verified, verification_token, verification_expires)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(normalized, passwordHash, name, autoVerify ? 1 : 0, autoVerify ? null : token, autoVerify ? null : expires);

  return {
    user: getUserById(result.lastInsertRowid),
    verificationToken: autoVerify ? null : token,
    autoVerified: autoVerify,
  };
}

export function verifyEmail(token) {
  const row = db.prepare(`
    SELECT id, verification_expires, email_verified FROM users
    WHERE verification_token = ?
  `).get(token);

  if (!row) throw new Error('Invalid or expired verification link');
  if (new Date(row.verification_expires) < new Date()) {
    throw new Error('Verification link has expired — request a new one');
  }
  if (!row.email_verified) {
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(row.id);
  }

  return getUserById(row.id);
}

export function resendVerification(email) {
  const normalized = email.trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalized);
  if (!row) throw new Error('No account found for this email');
  if (row.email_verified) throw new Error('This email is already verified — try logging in');

  const token = createVerificationToken();
  const expires = verificationExpiry();
  db.prepare(`
    UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?
  `).run(token, expires, row.id);

  return { user: getUserById(row.id), verificationToken: token };
}

export function requestPasswordReset(email) {
  const normalized = email.trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalized);
  if (!row || !row.email_verified) {
    return null;
  }

  const token = createVerificationToken();
  const expires = resetExpiry();
  db.prepare(`
    UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?
  `).run(token, expires, row.id);

  return { user: getUserById(row.id), resetToken: token };
}

export function resetPassword(token, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const row = db.prepare(`
    SELECT id, reset_expires FROM users WHERE reset_token = ?
  `).get(token);

  if (!row) throw new Error('Invalid or expired reset link');
  if (new Date(row.reset_expires) < new Date()) {
    throw new Error('Reset link has expired — request a new one');
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare(`
    UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?
  `).run(passwordHash, row.id);

  return getUserById(row.id);
}

export function authenticateUser(email, password) {
  const normalized = email.trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalized);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new Error('Invalid email or password');
  }
  if (!user.email_verified) {
    const err = new Error('Please verify your email before logging in — check your inbox');
    err.code = 'EMAIL_NOT_VERIFIED';
    throw err;
  }
  return getUserById(user.id);
}

export function getUserById(id) {
  const user = db.prepare(`
    SELECT id, email, display_name, created_at, email_verified FROM users WHERE id = ?
  `).get(id);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    createdAt: user.created_at,
    emailVerified: !!user.email_verified,
  };
}

export function getUserByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const user = db.prepare(`
    SELECT id, email, display_name, created_at, email_verified FROM users WHERE email = ?
  `).get(normalized);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    createdAt: user.created_at,
    emailVerified: !!user.email_verified,
  };
}

export function setMedTaken(userId, date, slot, takenAt) {
  db.prepare(`
    INSERT INTO medications (user_id, date, slot, taken_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date, slot) DO UPDATE SET taken_at = excluded.taken_at
  `).run(userId, date, slot, takenAt);
}

export function getMedsForDate(userId, date) {
  const rows = db.prepare('SELECT slot, taken_at FROM medications WHERE user_id = ? AND date = ?').all(userId, date);
  return {
    morning: rows.find((r) => r.slot === 'morning')?.taken_at ?? null,
    evening: rows.find((r) => r.slot === 'evening')?.taken_at ?? null,
    bp: rows.find((r) => r.slot === 'bp')?.taken_at ?? null,
  };
}

export function toggleMed(userId, date, slot) {
  const existing = db.prepare(
    'SELECT taken_at FROM medications WHERE user_id = ? AND date = ? AND slot = ?',
  ).get(userId, date, slot);

  if (existing?.taken_at) {
    db.prepare('DELETE FROM medications WHERE user_id = ? AND date = ? AND slot = ?').run(userId, date, slot);
    return null;
  }

  const takenAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO medications (user_id, date, slot, taken_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date, slot) DO UPDATE SET taken_at = excluded.taken_at
  `).run(userId, date, slot, takenAt);
  return takenAt;
}

export function getMealsForDate(userId, date) {
  return db.prepare('SELECT * FROM meals WHERE user_id = ? AND date = ? ORDER BY time ASC').all(userId, date);
}

export function addMeal(userId, meal) {
  const {
    date, time, name, carbs, sugar, calories,
    protein, fat, saturated_fat, fiber, salt, nutri_score, serving_size, notes,
  } = meal;
  const result = db.prepare(`
    INSERT INTO meals (
      user_id, date, time, name, carbs, sugar, calories,
      protein, fat, saturated_fat, fiber, salt, nutri_score, serving_size, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId, date, time, name,
    carbs ?? null, sugar ?? null, calories ?? null,
    protein ?? null, fat ?? null, saturated_fat ?? null,
    fiber ?? null, salt ?? null, nutri_score ?? null, serving_size ?? null, notes ?? null,
  );
  return db.prepare('SELECT * FROM meals WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, userId);
}

export function deleteMeal(userId, id) {
  return db.prepare('DELETE FROM meals WHERE id = ? AND user_id = ?').run(id, userId);
}

export function updateMeal(userId, id, meal) {
  const existing = db.prepare('SELECT id FROM meals WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) throw new Error('Meal not found');

  const {
    date, time, name, carbs, sugar, calories,
    protein, fat, saturated_fat, fiber, salt, nutri_score, serving_size, notes,
  } = meal;

  if (!date || !time || !name?.trim()) {
    throw new Error('Date, time, and name are required');
  }

  db.prepare(`
    UPDATE meals SET
      date = ?, time = ?, name = ?, carbs = ?, sugar = ?, calories = ?,
      protein = ?, fat = ?, saturated_fat = ?, fiber = ?, salt = ?,
      nutri_score = ?, serving_size = ?, notes = ?
    WHERE id = ? AND user_id = ?
  `).run(
    date, time, name.trim(),
    carbs ?? null, sugar ?? null, calories ?? null,
    protein ?? null, fat ?? null, saturated_fat ?? null,
    fiber ?? null, salt ?? null, nutri_score ?? null, serving_size ?? null, notes ?? null,
    id, userId,
  );

  return db.prepare('SELECT * FROM meals WHERE id = ? AND user_id = ?').get(id, userId);
}

export function getFrequentMeals(userId, limit = 12) {
  return db.prepare(`
    WITH ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY name ORDER BY date DESC, time DESC, id DESC) AS rn,
        COUNT(*) OVER (PARTITION BY name) AS freq
      FROM meals
      WHERE user_id = ?
    )
    SELECT id, name, time, carbs, sugar, calories, protein, fat, saturated_fat,
           fiber, salt, nutri_score, serving_size, notes, freq, date AS last_date
    FROM ranked
    WHERE rn = 1
    ORDER BY freq DESC, last_date DESC, name ASC
    LIMIT ?
  `).all(userId, limit);
}

export function getHistory(userId, days = 90) {
  const allTime = !days || days <= 0;

  const meds = allTime
    ? db.prepare(`
        SELECT date, slot, taken_at FROM medications
        WHERE user_id = ?
        ORDER BY date DESC, slot ASC
      `).all(userId)
    : db.prepare(`
        SELECT date, slot, taken_at FROM medications
        WHERE user_id = ? AND date >= date('now', '-' || ? || ' days')
        ORDER BY date DESC, slot ASC
      `).all(userId, days);

  const meals = allTime
    ? db.prepare(`
        SELECT id, date, time, name, carbs, sugar, calories,
               protein, fat, saturated_fat, fiber, salt, nutri_score, serving_size, notes
        FROM meals WHERE user_id = ?
        ORDER BY date DESC, time ASC
      `).all(userId)
    : db.prepare(`
        SELECT id, date, time, name, carbs, sugar, calories,
               protein, fat, saturated_fat, fiber, salt, nutri_score, serving_size, notes
        FROM meals
        WHERE user_id = ? AND date >= date('now', '-' || ? || ' days')
        ORDER BY date DESC, time ASC
      `).all(userId, days);

  return { meds, meals };
}

export function getSetting(userId, key) {
  return db.prepare('SELECT value FROM settings WHERE user_id = ? AND key = ?').get(userId, key)?.value ?? null;
}

export function setSetting(userId, key, value) {
  db.prepare(`
    INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `).run(userId, key, String(value));
}
