import { query, withTransaction } from '../config/database.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import { EventCategory } from '../types/index.js';

export const eventService = {
  async listEvents(currentUserId: string, category?: string) {
    const params: any[] = [currentUserId];
    let whereClause = `e.deleted_at IS NULL AND e.status = 'active'`;

    if (category && category !== 'all') {
      params.push(category);
      whereClause += ` AND e.category = $${params.length}`;
    }

    // PRIVACY ENFORCEMENT: Never expose student organizer_id or real name in events!
    const sql = `
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
        CASE WHEN e.organizer_id = $1 THEN TRUE ELSE FALSE END as is_organizer,
        CASE WHEN er.id IS NOT NULL THEN TRUE ELSE FALSE END as is_registered
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      LEFT JOIN event_registrations er ON er.event_id = e.id AND er.user_id = $1
      WHERE ${whereClause}
      ORDER BY e.event_date ASC, e.event_time ASC
    `;

    const res = await query(sql, params);
    return res.rows;
  },

  async getEventById(eventId: string, currentUserId: string) {
    // PRIVACY ENFORCEMENT: Never expose student organizer_id or real name in event details!
    const sql = `
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
        CASE WHEN e.organizer_id = $2 THEN TRUE ELSE FALSE END as is_organizer,
        CASE WHEN er.id IS NOT NULL THEN TRUE ELSE FALSE END as is_registered
      FROM events e
      JOIN users u ON e.organizer_id = u.id
      LEFT JOIN event_registrations er ON er.event_id = e.id AND er.user_id = $2
      WHERE e.id = $1 AND e.deleted_at IS NULL
    `;

    const res = await query(sql, [eventId, currentUserId]);
    if (res.rowCount === 0) {
      throw new NotFoundError('Event not found');
    }
    return res.rows[0];
  },

  async createEvent(
    organizerId: string,
    data: {
      title: string;
      description: string;
      category: EventCategory;
      venue: string;
      eventDate: string;
      eventTime: string;
      bannerUrl?: string | null;
      capacity?: number;
    }
  ) {
    const res = await query(
      `INSERT INTO events 
       (organizer_id, title, description, category, venue, event_date, event_time, banner_url, capacity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, description, category, venue, event_date, event_time, banner_url, capacity, registrations_count, created_at`,
      [
        organizerId,
        data.title,
        data.description,
        data.category,
        data.venue,
        data.eventDate,
        data.eventTime,
        data.bannerUrl || null,
        data.capacity || 100
      ]
    );
    return res.rows[0];
  },

  async registerForEvent(userId: string, eventId: string) {
    return await withTransaction(async (client) => {
      // Row lock event to prevent race condition on capacity limit
      const eventRes = await client.query(
        'SELECT id, capacity, registrations_count FROM events WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [eventId]
      );

      if (eventRes.rowCount === 0) {
        throw new NotFoundError('Event not found');
      }

      const event = eventRes.rows[0];

      if (event.registrations_count >= event.capacity) {
        throw new BadRequestError('Event has reached its maximum registration capacity');
      }

      const existingReg = await client.query(
        'SELECT id FROM event_registrations WHERE event_id = $1 AND user_id = $2',
        [eventId, userId]
      );

      if (existingReg.rowCount && existingReg.rowCount > 0) {
        throw new ConflictError('You are already registered for this event');
      }

      await client.query(
        'INSERT INTO event_registrations (event_id, user_id) VALUES ($1, $2)',
        [eventId, userId]
      );

      await client.query(
        'UPDATE events SET registrations_count = registrations_count + 1 WHERE id = $1',
        [eventId]
      );

      return { success: true, message: 'Successfully registered for event' };
    });
  }
};
