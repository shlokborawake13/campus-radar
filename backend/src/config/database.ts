import dns from 'node:dns';
import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const { Pool } = pg;

// Supabase and hosted PostgreSQL instances often require SSL with rejectUnauthorized: false
const requiresSsl = 
  env.NODE_ENV === 'production' || 
  env.DATABASE_URL.includes('supabase.co') || 
  env.DATABASE_URL.includes('sslmode=require') ||
  env.DATABASE_URL.includes('pooler.supabase.com');

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_MAX_CONNECTIONS,
  idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false,
  // Prevent long-running queries from consuming resources (30 second timeout)
  statement_timeout: 30000
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    // SECURITY: Only log query text in development to prevent leaking sensitive context in production logs
    logger.debug('Executed query', {
      text: env.NODE_ENV !== 'production' ? text : '[REDACTED]',
      duration,
      rows: res.rowCount
    });
    return res;
  } catch (err: any) {
    logger.error('Database query failed', {
      text: env.NODE_ENV !== 'production' ? text : '[REDACTED]',
      error: err.message
    });
    throw err;
  }
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
