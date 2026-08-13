/** Same as seed-demo, but targets the DEV database. */
process.env.APP_ENV = 'development';
process.env.DB_FILE = process.env.DB_FILE || 'diabetes-dev.db';
process.env.BACKUP_DIR_NAME = process.env.BACKUP_DIR_NAME || 'backups-dev';

await import('./seed-demo-cli.js');
