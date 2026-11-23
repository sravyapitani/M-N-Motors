// Starts a local PostgreSQL server for development (no Docker or system install needed).
// Data lives in ./.local-db and persists between runs.
// Matches backend/.env: postgresql://postgres:postgres@localhost:5433/nexus_erp
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 5433;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, '.local-db');
const pidFile = join(dataDir, 'postmaster.pid');

const keepAlive = () => setInterval(() => {}, 1 << 30);

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

function processAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// 1. A server is already listening (e.g. a previous `npm run dev` left it running): reuse it.
if (await portInUse(PORT)) {
  console.log(`PostgreSQL already running on localhost:${PORT} - reusing it.`);
  keepAlive();
} else {
  // 2. Lock file left behind by a crash or a force-closed terminal: remove it if its process is gone.
  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, 'utf8').split(/\r?\n/)[0], 10);
    if (!pid || !processAlive(pid)) {
      console.log('Removing stale postmaster.pid from a previous run.');
      rmSync(pidFile, { force: true });
    } else {
      console.error(
        `PostgreSQL process ${pid} holds .local-db but is not listening on ${PORT}. ` +
          `Stop it (Task Manager -> postgres.exe) and run again.`,
      );
      process.exit(1);
    }
  }

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
  });

  if (!existsSync(join(dataDir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase('nexus_erp');
  } catch {
    // database already exists
  }
  console.log(`PostgreSQL ready on localhost:${PORT} (database: nexus_erp)`);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try { await pg.stop(); } catch { /* already stopped */ }
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('SIGHUP', stop);
  keepAlive();
}
