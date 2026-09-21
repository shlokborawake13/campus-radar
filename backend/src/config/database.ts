import dns from 'node:dns';
import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const { Pool } = pg;

/**
 * Normalizes PostgreSQL connection string.
 * Supabase direct endpoints (db.<ref>.supabase.co:5432) have no IPv4 A records and fail on Render with ENETUNREACH.
 * This helper automatically adapts direct Supabase URLs to the IPv4 Pooler endpoint.
 */
function getNormalizedDatabaseUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.searchParams.delete('sslmode');

    if (url.hostname.startsWith('db.') && url.hostname.endsWith('.supabase.co')) {
      const projectRef = url.hostname.split('.')[1];
      url.hostname = 'aws-0-ap-south-1.pooler.supabase.com';
      url.port = '5432';
      if (!url.username.includes('.')) {
        url.username = `postgres.${projectRef}`;
      }
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

const connectionString = getNormalizedDatabaseUrl(env.DATABASE_URL);

// Supabase and hosted PostgreSQL instances require SSL with rejectUnauthorized: false
const requiresSsl = 
  env.NODE_ENV === 'production' || 
  connectionString.includes('supabase.co') || 
  connectionString.includes('pooler.supabase.com') ||
  env.DATABASE_URL.includes('sslmode=require');

export const pool = new Pool({
  connectionString,
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
