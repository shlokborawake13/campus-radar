import { pool } from '../config/database.js';

async function runExplain() {
  const client = await pool.connect();
  try {
    console.log('--- 1. EXPLAIN ANALYZE: POSTS FEED QUERY ---');
    const q1 = await client.query(`
      EXPLAIN ANALYZE
      SELECT 
        p.id,
        p.content,
        p.image_url,
        p.tag,
        p.likes_count,
        p.comments_count,
        p.created_at,
        p.updated_at,
        COALESCE(u.anonymous_pseudonym, 'Anonymous #' || LPAD(u.anonymous_number::text, 2, '0')) as author_name,
        CASE WHEN p.author_id = '00000000-0000-0000-0000-000000000000' THEN TRUE ELSE FALSE END as is_owner,
        CASE WHEN pl.id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked,
        CASE WHEN sp.id IS NOT NULL THEN TRUE ELSE FALSE END as is_saved
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = '00000000-0000-0000-0000-000000000000'
      LEFT JOIN saved_posts sp ON sp.post_id = p.id AND sp.user_id = '00000000-0000-0000-0000-000000000000'
      WHERE p.deleted_at IS NULL AND p.status = 'active'
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT 16;
    `);
    console.log(q1.rows.map(r => r['QUERY PLAN']).join('\n'));

    console.log('\n--- 2. EXPLAIN ANALYZE: CONFESSIONS FEED QUERY ---');
    const q2 = await client.query(`
      EXPLAIN ANALYZE
      SELECT 
        c.id,
        c.anonymous_pseudonym,
        c.content,
        c.category,
        c.likes_count,
        c.comments_count,
        c.created_at,
        CASE WHEN cl.id IS NOT NULL THEN TRUE ELSE FALSE END as is_liked
      FROM confessions c
      LEFT JOIN confession_likes cl ON cl.confession_id = c.id AND cl.user_id = '00000000-0000-0000-0000-000000000000'
      WHERE c.deleted_at IS NULL AND c.status = 'active'
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT 16;
    `);
    console.log(q2.rows.map(r => r['QUERY PLAN']).join('\n'));

    console.log('\n--- 3. EXPLAIN ANALYZE: EVENTS UPCOMING QUERY ---');
    const q3 = await client.query(`
      EXPLAIN ANALYZE
      SELECT 
        e.id,
        e.title,
        e.description,
        e.category,
        e.venue,
        e.event_date,
        e.event_time,
        e.banner_url,
        e.capacity,
        e.registrations_count,
        e.created_at,
        COALESCE(u.anonymous_pseudonym, 'Campus Organizer') as organizer_name,
        CASE WHEN e.organizer_id = '00000000-0000-0000-0000-000000000000' THEN TRUE ELSE FALSE END as is_organizer,
        CASE WHEN er.id IS NOT NULL THEN TRUE ELSE FALSE END as is_registered
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      LEFT JOIN event_registrations er ON er.event_id = e.id AND er.user_id = '00000000-0000-0000-0000-000000000000'
      WHERE e.deleted_at IS NULL AND e.status = 'active'
      ORDER BY e.event_date ASC, e.event_time ASC, e.id ASC
      LIMIT 16;
    `);
    console.log(q3.rows.map(r => r['QUERY PLAN']).join('\n'));

  } finally {
    client.release();
    await pool.end();
  }
}

runExplain().catch(console.error);
