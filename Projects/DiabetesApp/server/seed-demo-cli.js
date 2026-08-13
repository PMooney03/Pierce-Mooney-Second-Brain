/**
 * Fill ONE account with sample meals/tablets for README screenshots.
 *
 * Usage (production DB):
 *   npm run seed-demo -- you@email.com
 *
 * Usage (dev DB):
 *   npm run seed-demo:dev -- you@email.com
 *
 * Only that user's data is touched. Other accounts are left alone.
 */
import { addMeal, getUserByEmail, setMedTaken } from './db.js';
import { MED_SLOTS } from './medUtils.js';

const email = process.argv[2]?.trim();
if (!email) {
  console.error('Usage: npm run seed-demo -- you@email.com');
  process.exit(1);
}

const user = getUserByEmail(email);
if (!user) {
  console.error(`No account found for ${email}. Sign up / log in once first, then re-run.`);
  process.exit(1);
}
if (!user.emailVerified) {
  console.error(`Account ${email} is not verified yet.`);
  process.exit(1);
}

function dayOffset(daysAgo) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoAt(dateStr, hour, minute) {
  return new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).toISOString();
}

const mealTemplates = [
  {
    time: '08:15',
    name: 'Coffee with milk',
    calories: 25,
    carbs: 2,
    sugar: 1,
    protein: 1,
    fat: 1,
    saturated_fat: 0.5,
    fiber: 0,
    salt: 0.05,
    nutri_score: 'A',
    serving_size: '1 cup',
  },
  {
    time: '11:20',
    name: 'Scrambled eggs & 2 toast',
    calories: 380,
    carbs: 28,
    sugar: 2,
    protein: 18,
    fat: 20,
    saturated_fat: 6,
    fiber: 3,
    salt: 1.2,
    nutri_score: 'B',
    serving_size: '1 plate',
  },
  {
    time: '13:45',
    name: 'Chicken sandwich',
    calories: 420,
    carbs: 38,
    sugar: 4,
    protein: 28,
    fat: 14,
    saturated_fat: 3,
    fiber: 4,
    salt: 1.5,
    nutri_score: 'B',
    serving_size: '1 sandwich',
  },
  {
    time: '18:30',
    name: 'Salmon, potatoes & veg',
    calories: 520,
    carbs: 42,
    sugar: 5,
    protein: 35,
    fat: 22,
    saturated_fat: 4,
    fiber: 6,
    salt: 1.1,
    nutri_score: 'A',
    serving_size: '1 dinner plate',
  },
];

let mealsAdded = 0;
let medsAdded = 0;

for (let ago = 6; ago >= 0; ago--) {
  const date = dayOffset(ago);

  // Most days: all tablets; one day misses evening for a realistic History look
  const slots = ago === 2 ? ['morning', 'bp'] : [...MED_SLOTS];
  for (const slot of slots) {
    const hour = slot === 'morning' ? 8 : slot === 'bp' ? 12 : 20;
    setMedTaken(user.id, date, slot, isoAt(date, hour, 5));
    medsAdded += 1;
  }

  const mealsForDay = ago === 0 ? mealTemplates : mealTemplates.slice(0, 3);
  for (const meal of mealsForDay) {
    addMeal(user.id, {
      date,
      notes: 'Demo data for screenshots',
      ...meal,
    });
    mealsAdded += 1;
  }
}

console.log(`Seeded demo data for ${user.email} (${user.displayName})`);
console.log(`Database: ${process.env.DB_FILE || 'diabetes.db'}`);
console.log(`Tablets set: ${medsAdded}`);
console.log(`Meals added: ${mealsAdded}`);
console.log('Log in as that account, open Dashboard / Food / History, and take screenshots.');
