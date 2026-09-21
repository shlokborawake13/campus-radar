import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, withTransaction } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  logger.info('Starting database migrations...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const executedRes = await pool.query<{ filename: string }>('SELECT filename FROM _migrations');
  const executedFiles = new Set(executedRes.rows.map((r) => r.filename));

  const allFiles = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of allFiles) {
    if (executedFiles.has(file)) {
      logger.info(`Skipping already executed migration: ${file}`);
      continue;
    }

    logger.info(`Applying migration: ${file}...`);
    const filePath = path.join(__dirname, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
    });

    logger.info(`Successfully applied migration: ${file}`);
  }

  logger.info('All database migrations completed successfully.');
}

runMigrations()
  .catch((err) => {
    logger.error('Migration failed', { error: err.message, stack: err.stack });
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
