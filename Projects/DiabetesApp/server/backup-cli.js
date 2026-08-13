import { runBackup } from './backup.js';

const result = runBackup();

if (result.skipped) {
  console.log(result.reason);
  process.exit(0);
}

console.log(`Created: ${result.created}`);
console.log(`Latest: ${result.latest}`);
console.log(`Kept: ${result.kept.map((k) => `${k.file} (${k.ageDays}d)`).join(', ')}`);
if (result.removed.length) {
  console.log(`Removed: ${result.removed.join(', ')}`);
}
