import { chmodSync, copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Saves a private copy of .env under your user profile (~/.academic-digital-twin/.env.backup),
 * readable only by you. Deliberately NOT inside the project folder: project folders get zipped
 * and shared, and a copy there would ship the database password and JWT secret with them.
 * Restore with `npm run env:restore`.
 */
const envPath = resolve(process.cwd(), '.env');
const backupDirectory = join(homedir(), '.academic-digital-twin');
const durableBackupPath = join(backupDirectory, '.env.backup');
const legacyProjectCopy = resolve(process.cwd(), '.env.backup');

try {
  if (!existsSync(envPath)) {
    throw new Error('.env was not found; create it before backing it up.');
  }
  if (statSync(envPath).size === 0) {
    throw new Error('.env is empty; refusing to replace an existing backup with an empty file.');
  }

  mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') chmodSync(backupDirectory, 0o700);

  copyFileSync(envPath, durableBackupPath);
  if (process.platform !== 'win32') chmodSync(durableBackupPath, 0o600);

  console.log(`Environment backed up to ${durableBackupPath} (outside the project, so it is never zipped or shared).`);
  if (existsSync(legacyProjectCopy)) {
    console.warn('Warning: an old .env.backup is in the project folder. Delete it: it contains your secrets and would be included if the folder is zipped.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to back up .env.');
  process.exitCode = 1;
}
