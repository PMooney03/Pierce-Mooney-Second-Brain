import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const RETENTION_DAYS = [0, 1, 3, 7, 31];
export const BACKUP_DIR = join(__dirname, process.env.BACKUP_DIR_NAME || 'backups');
export const DB_PATH = join(__dirname, process.env.DB_FILE || 'diabetes.db');

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(dateStr, todayStr) {
  const from = new Date(`${dateStr}T12:00:00`);
  const to = new Date(`${todayStr}T12:00:00`);
  return Math.round((to - from) / 86_400_000);
}

function parseBackupDate(filename) {
  const match = /^diabetes-(\d{4}-\d{2}-\d{2})\.db$/.exec(filename);
  return match ? match[1] : null;
}

function sqlPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/'/g, "''");
}

function copyDatabase(destPath) {
  if (existsSync(destPath)) unlinkSync(destPath);

  const source = new DatabaseSync(DB_PATH);
  try {
    source.exec(`VACUUM INTO '${sqlPath(destPath)}'`);
  } finally {
    source.close();
  }
}

export function runBackup() {
  if (!existsSync(DB_PATH)) {
    return { skipped: true, reason: 'Database file does not exist yet' };
  }

  mkdirSync(BACKUP_DIR, { recursive: true });

  const today = todayString();
  const datedName = `diabetes-${today}.db`;
  const datedPath = join(BACKUP_DIR, datedName);
  const latestPath = join(BACKUP_DIR, 'diabetes-latest.db');

  copyDatabase(datedPath);
  copyDatabase(latestPath);

  const kept = [];
  const removed = [];

  for (const file of readdirSync(BACKUP_DIR)) {
    const date = parseBackupDate(file);
    if (!date) continue;

    const ageDays = daysBetween(date, today);
    if (RETENTION_DAYS.includes(ageDays)) {
      kept.push({ file, ageDays });
    } else {
      unlinkSync(join(BACKUP_DIR, file));
      removed.push(file);
    }
  }

  return {
    skipped: false,
    created: datedName,
    latest: 'diabetes-latest.db',
    kept,
    removed,
  };
}

function logBackupResult(result) {
  if (result.skipped) {
    console.log(`Backup: ${result.reason}`);
    return;
  }

  const ages = result.kept.map((k) => k.ageDays).sort((a, b) => a - b);
  console.log(`Backup saved: ${result.created} (+ ${result.latest})`);
  console.log(`Backup retention: keeping snapshots at ${ages.join(', ')} day(s) old`);
  if (result.removed.length) {
    console.log(`Backup cleanup: removed ${result.removed.length} old file(s)`);
  }
}

export function scheduleBackups(intervalMs = BACKUP_INTERVAL_MS) {
  const run = () => {
    try {
      logBackupResult(runBackup());
    } catch (err) {
      console.error('Backup failed:', err.message);
    }
  };

  run();
  return setInterval(run, intervalMs);
}
