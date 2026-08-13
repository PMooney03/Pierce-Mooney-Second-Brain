/**
 * Frees DEV ports 3002 (API) and 5173 (Vite) on Windows so `npm run dev` can start cleanly.
 * Does not touch prod port 3001.
 */
import { execSync } from 'node:child_process';

const PORTS = [3002, 5173];

function listeningPids(port) {
  let out = '';
  try {
    out = execSync('netstat -ano', { encoding: 'utf8' });
  } catch {
    return [];
  }

  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) continue;
    // Match :3002 with word boundary-ish (space or end after port)
    const match = line.match(new RegExp(`:${port}\\s+.+LISTENING\\s+(\\d+)\\s*$`));
    if (match) pids.add(match[1]);
  }
  return [...pids];
}

for (const port of PORTS) {
  for (const pid of listeningPids(port)) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
      console.log(`Freed port ${port} (killed PID ${pid})`);
    } catch {
      console.log(`Could not kill PID ${pid} on port ${port} — try closing that terminal manually`);
    }
  }
}

console.log('DEV ports ready (3002, 5173). Prod 3001 left alone.');
