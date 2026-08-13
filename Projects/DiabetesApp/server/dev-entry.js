/**
 * Dev entry — sets a separate port + database before loading the server,
 * so production (npm start on 3001 / diabetes.db) is never touched.
 */
process.env.APP_ENV = 'development';
process.env.PORT = process.env.PORT || '3002';
process.env.DB_FILE = process.env.DB_FILE || 'diabetes-dev.db';
process.env.BACKUP_DIR_NAME = process.env.BACKUP_DIR_NAME || 'backups-dev';

await import('./index.js');
