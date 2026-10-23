import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('🔄 Running database migrations...');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const alreadyApplied = await db.prepare('SELECT id FROM _migrations WHERE filename = ?').get(file);
    if (alreadyApplied) {
      console.log(`⏩ Skipping already applied migration: ${file}`);
      continue;
    }

    console.log(`⚡ Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.exec(sql);
    await db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
    console.log(`✅ Applied migration: ${file}`);
  }

  console.log('🎉 All migrations successfully executed.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await runMigrations();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}
