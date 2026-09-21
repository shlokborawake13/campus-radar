/* ============================================
   CAMPUS RADAR — ADMIN EVENTS
   Connected to live PostgreSQL database & backend
   ============================================ */
import { icon } from '../../utils/icons.js';
import { api } from '../../services/api.js';
import { formatDate, showToast } from '../../utils/helpers.js';

export function renderAdminEvents(mainEl) {
  mainEl.innerHTML = `
    <div class="anim-fade-in-up">
      <p class="eyebrow">Event Management</p>
      <h1 class="heading-section">Campus Events</h1>
    </div>

    <div class="flex-between anim-fade-in-up" style="margin-bottom: var(--space-6); flex-wrap: wrap; gap: var(--space-4);">
      <div class="search-bar" style="max-width: 320px;">
        <span class="search-icon">${icon('search')}</span>
        <input type="text" class="input" placeholder="Search events..." id="admin-event-search" />
      </div>
      <button class="btn btn--primary btn--sm" id="create-event-btn">${icon('plus')} Create Event</button>
    </div>

    <div id="events-error-container"></div>

    <div class="table-wrapper anim-fade-in-up" style="animation-delay: 100ms;">
      <table class="table" id="events-table">
        <thead>
          <tr>
            <th>Event Title</th>
            <th>Category</th>
            <th>Venue / Location</th>
            <th>Date & Time</th>
            <th>Registrations</th>
            <th>Organizer</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="events-tbody">
          <tr>
            <td colspan="8" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
              Loading campus events...
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Event Modal Container -->
    <div id="event-modal-container"></div>
  `;

  const tbody = mainEl.querySelector('#events-tbody');
  const errorContainer = mainEl.querySelector('#events-error-container');
  const modalContainer = mainEl.querySelector('#event-modal-container');
  let searchQuery = '';
  let searchTimeout = null;

  async function fetchEvents() {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
          Loading events...
        </td>
      </tr>
    `;
    errorContainer.innerHTML = '';

    try {
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.getAdminEvents(params);
      const events = res.events || [];

      if (events.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
              No campus events found
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = events.map(event => `
        <tr>
          <td style="color: var(--text-primary); font-weight: var(--weight-medium);">${event.title}</td>
          <td><span class="badge" style="background: var(--bg-tertiary);">${event.category}</span></td>
          <td>${event.venue}</td>
          <td class="meta-text">${formatDate(event.event_date)} ${event.event_time ? '• ' + event.event_time : ''}</td>
          <td>${event.registrations_count || 0}/${event.capacity || 100}</td>
          <td class="meta-text">${event.organizer_name || 'Campus Admin'}</td>
          <td><span class="badge badge--success">${event.status}</span></td>
          <td>
            <div style="display:flex; gap: var(--space-2);">
              <button class="btn btn--ghost btn--sm" data-action="delete" data-id="${event.id}" title="Cancel Event" style="color: var(--color-error);">
                ${icon('trash')}
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      errorContainer.innerHTML = `
        <div class="card" style="border-left: 4px solid var(--color-error); padding: var(--space-4); margin-bottom: var(--space-4); background: rgba(224, 90, 71, 0.08);">
          <div class="flex-between">
            <p style="color: var(--color-error); font-size: 14px;">Failed to load events: ${err.message || 'Database error'}</p>
            <button class="btn btn--secondary btn--sm" id="retry-events-btn">Retry</button>
          </div>
        </div>
      `;
      mainEl.querySelector('#retry-events-btn')?.addEventListener('click', fetchEvents);
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: var(--space-6); color: var(--color-error);">
            Error loading events
          </td>
        </tr>
      `;
    }
  }

  mainEl.querySelector('#admin-event-search').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      fetchEvents();
    }, 300);
  });

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    const eventId = btn.dataset.id;

    if (!confirm('Are you sure you want to cancel and remove this campus event?')) return;
    try {
      btn.disabled = true;
      await api.deleteAdminEvent(eventId);
      showToast('Event removed');
      fetchEvents();
    } catch (err) {
      showToast(err.message || 'Failed to remove event');
      btn.disabled = false;
    }
  });

  // Modal for Create Event
  mainEl.querySelector('#create-event-btn').addEventListener('click', () => {
    modalContainer.innerHTML = `
      <div class="modal-overlay" id="event-modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--space-4);">
        <div class="card anim-fade-in-up" style="max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; background: var(--bg-card);">
          <div class="flex-between" style="margin-bottom: var(--space-4);">
            <h3 class="heading-small">Create New Event</h3>
            <button class="btn btn--ghost btn--sm" id="close-modal-btn">✕</button>
          </div>

          <form id="new-event-form">
            <div class="input-group" style="margin-bottom: var(--space-3);">
              <label class="input-label">Event Title *</label>
              <input type="text" class="input" id="ev-title" required placeholder="e.g. Annual Hackathon 2026" />
            </div>

            <div class="input-group" style="margin-bottom: var(--space-3);">
              <label class="input-label">Description *</label>
              <textarea class="input" id="ev-desc" required rows="3" placeholder="Details about this campus event..."></textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">
              <div class="input-group">
                <label class="input-label">Category</label>
                <select class="input" id="ev-category">
                  <option value="hackathon">Hackathon</option>
                  <option value="cultural">Cultural</option>
                  <option value="workshop">Workshop</option>
                  <option value="sports">Sports</option>
                  <option value="seminar">Seminar</option>
                  <option value="general" selected>General</option>
                </select>
              </div>
              <div class="input-group">
                <label class="input-label">Max Capacity</label>
                <input type="number" class="input" id="ev-capacity" value="100" min="1" />
              </div>
            </div>

            <div class="input-group" style="margin-bottom: var(--space-3);">
              <label class="input-label">Venue / Location *</label>
              <input type="text" class="input" id="ev-venue" required placeholder="e.g. Audi 2, Engineering Block" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-4);">
              <div class="input-group">
                <label class="input-label">Date *</label>
                <input type="date" class="input" id="ev-date" required />
              </div>
              <div class="input-group">
                <label class="input-label">Time *</label>
                <input type="text" class="input" id="ev-time" required placeholder="e.g. 10:00 AM - 4:00 PM" />
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: var(--space-2);">
              <button type="button" class="btn btn--secondary btn--sm" id="cancel-event-btn">Cancel</button>
              <button type="submit" class="btn btn--primary btn--sm" id="submit-event-btn">Publish Event</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const closeBtn = modalContainer.querySelector('#close-modal-btn');
    const cancelBtn = modalContainer.querySelector('#cancel-event-btn');
    const overlay = modalContainer.querySelector('#event-modal-overlay');
    const form = modalContainer.querySelector('#new-event-form');

    const closeModal = () => { modalContainer.innerHTML = ''; };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('#submit-event-btn');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Publishing...';

      try {
        await api.createAdminEvent({
          title: form.querySelector('#ev-title').value.trim(),
          description: form.querySelector('#ev-desc').value.trim(),
          category: form.querySelector('#ev-category').value,
          capacity: parseInt(form.querySelector('#ev-capacity').value, 10) || 100,
          venue: form.querySelector('#ev-venue').value.trim(),
          event_date: form.querySelector('#ev-date').value,
          event_time: form.querySelector('#ev-time').value.trim()
        });
        showToast('Campus event published successfully');
        closeModal();
        fetchEvents();
      } catch (err) {
        showToast(err.message || 'Failed to create event');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Publish Event';
      }
    });
  });

  fetchEvents();
}

