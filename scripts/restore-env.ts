import { chmodSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
const localBackupPath = resolve(process.cwd(), '.env.backup');
const durableBackupPath = join(homedir(), '.academic-digital-twin', '.env.backup');

try {
  if (existsSync(envPath)) {
    console.log('.env already exists; leaving it unchanged.');
  } else {
    const backupPath = [durableBackupPath, localBackupPath].find(
      (candidate) => existsSync(candidate) && statSync(candidate).size > 0,
    );
    if (!backupPath) {
      throw new Error('No .env.backup found in the user profile or project directory.');
    }

    copyFileSync(backupPath, envPath);
    if (process.platform !== 'win32') chmodSync(envPath, 0o600);
    const backupLocation = backupPath === durableBackupPath ? 'the user-profile backup' : '.env.backup';
    console.log(`Restored .env from ${backupLocation}.`);
    if (backupPath === localBackupPath) {
      console.warn('Warning: delete the project-folder .env.backup now and run `npm run env:backup`; a copy inside the project would be included if the folder is zipped.');
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to restore .env.');
  process.exitCode = 1;
}
