/* ============================================
   CAMPUS RADAR — EVENTS PAGE
   Discover & register for campus happenings
   ============================================ */
import { renderEventCard } from '../components/eventCard.js';
import { api, tokenStorage } from '../services/api.js';
import { icon } from '../utils/icons.js';
import { showToast } from '../utils/helpers.js';
import { navigate } from '../router.js';

const categories = ['All', 'Hackathon', 'Workshop', 'Cultural', 'Sports', 'Seminar', 'General'];

export function renderEvents(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-wrapper';

  wrapper.innerHTML = `
    <div class="page-content">
      <div class="section-header anim-fade-in-up">
        <p class="eyebrow">Campus Events</p>
        <h1 class="heading-hero">What's happening<br>next?</h1>
        <p class="body-text">Workshops, hackathons, sports, and cultural festivals at Sanjivani.</p>
      </div>

      <div class="anim-fade-in-up" style="text-align: center; margin-bottom: var(--space-6);">
        <button class="btn btn--primary" id="toggle-event-form">
          ${icon('plus')} Host / List an Event
        </button>
      </div>

      <!-- Create Event Form (Collapsible) -->
      <div class="card anim-fade-in-up" id="event-form-card" style="display: none; max-width: 680px; margin: 0 auto var(--space-8); border: 1px solid var(--accent-primary);">
        <h3 class="heading-small" style="margin-bottom: var(--space-4);">Host a Campus Event</h3>
        <form id="create-event-form">
          <div class="input-group" style="margin-bottom: var(--space-3);">
            <label class="input-label">Event Title *</label>
            <input type="text" class="input" placeholder="e.g. Sanjivani HackSprint 2026" required id="event-title" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">
            <div class="input-group">
              <label class="input-label">Category *</label>
              <select class="input" id="event-category" style="width: 100%;">
                <option value="hackathon">Hackathon</option>
                <option value="workshop">Workshop</option>
                <option value="cultural">Cultural</option>
                <option value="sports">Sports</option>
                <option value="seminar">Seminar</option>
                <option value="general">General</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Venue / Hall *</label>
              <input type="text" class="input" placeholder="e.g. Main Auditorium / Lab 3" required id="event-venue" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">
            <div class="input-group">
              <label class="input-label">Date (YYYY-MM-DD) *</label>
              <input type="date" class="input" required id="event-date" />
            </div>
            <div class="input-group">
              <label class="input-label">Time *</label>
              <input type="text" class="input" placeholder="e.g. 10:00 AM - 4:00 PM" required id="event-time" />
            </div>
            <div class="input-group">
              <label class="input-label">Max Capacity</label>
              <input type="number" class="input" value="100" min="5" max="5000" id="event-capacity" />
            </div>
          </div>

          <div class="input-group" style="margin-bottom: var(--space-4);">
            <label class="input-label">Event Description *</label>
            <textarea class="input" rows="3" placeholder="Describe the agenda, prerequisites, prizes, and rules..." required minlength="10" id="event-desc" style="resize: vertical;"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: var(--space-3);">
            <button type="button" class="btn btn--secondary" id="cancel-event-btn">Cancel</button>
            <button type="submit" class="btn btn--primary" id="submit-event-btn">Publish Event</button>
          </div>
        </form>
      </div>

      <div class="pills anim-fade-in-up" style="justify-content: center; margin-bottom: var(--space-8); flex-wrap: wrap;" id="event-filters">
        ${categories.map((cat, i) => `
          <button class="pill ${i === 0 ? 'pill--active' : ''}" data-filter="${cat.toLowerCase()}">${cat}</button>
        `).join('')}
      </div>

      <div class="events-grid stagger-children" id="events-grid">
        <div class="loading-spinner-wrapper" style="grid-column: 1/-1; text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
          <p>Loading campus events...</p>
        </div>
      </div>
    </div>
  `;

  const grid = wrapper.querySelector('#events-grid');
  const filters = wrapper.querySelector('#event-filters');
  const formCard = wrapper.querySelector('#event-form-card');
  const toggleBtn = wrapper.querySelector('#toggle-event-form');
  let currentFilter = 'all';

  async function loadEvents() {
    try {
      const res = await api.getEvents(currentFilter !== 'all' ? currentFilter : undefined);
      const eventsList = res.events || res.data || [];

      grid.innerHTML = '';
      if (eventsList.length === 0) {
        grid.innerHTML = `
          <div class="card" style="grid-column: 1/-1; text-align: center; padding: var(--space-12) var(--space-6); color: var(--text-secondary);">
            <div style="font-size: 2.5rem; margin-bottom: var(--space-3);">${icon('calendar')}</div>
            <h3 class="heading-small" style="margin-bottom: var(--space-2);">No upcoming events</h3>
            <p style="max-width: 360px; margin: 0 auto var(--space-6);">Have a club workshop, competition, or college fest to announce? Host an event!</p>
            <button class="btn btn--primary" id="empty-event-btn">Create Event</button>
          </div>
        `;
        grid.querySelector('#empty-event-btn')?.addEventListener('click', () => {
          formCard.style.display = 'block';
          wrapper.querySelector('#event-title')?.focus();
        });
        return;
      }

      eventsList.forEach(event => {
        grid.appendChild(renderEventCard(event));
      });
    } catch (err) {
      grid.innerHTML = `
        <div class="card" style="grid-column: 1/-1; text-align: center; padding: var(--space-8); color: var(--text-secondary);">
          <p style="color: var(--text-primary); margin-bottom: var(--space-2);">Could not fetch events.</p>
          <p class="body-small" style="margin-bottom: var(--space-4);">${err.message || 'Please log in to view events.'}</p>
          <button class="btn btn--secondary btn--sm" id="retry-events-btn">Retry</button>
        </div>
      `;
      grid.querySelector('#retry-events-btn')?.addEventListener('click', () => loadEvents());
    }
  }

  loadEvents();

  // Filter pills
  filters.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    filters.querySelectorAll('.pill').forEach(p => p.classList.remove('pill--active'));
    pill.classList.add('pill--active');
    currentFilter = pill.dataset.filter;
    loadEvents();
  });

  // Toggle Form
  toggleBtn.addEventListener('click', () => {
    const user = tokenStorage.getUser();
    if (!user) {
      showToast('Please sign in to host events');
      navigate('/login');
      return;
    }
    const isVisible = formCard.style.display !== 'none';
    formCard.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      wrapper.querySelector('#event-title')?.focus();
    }
  });

  wrapper.querySelector('#cancel-event-btn')?.addEventListener('click', () => {
    formCard.style.display = 'none';
  });

  // Create event submission
  wrapper.querySelector('#create-event-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = wrapper.querySelector('#event-title').value.trim();
    const category = wrapper.querySelector('#event-category').value;
    const venue = wrapper.querySelector('#event-venue').value.trim();
    const eventDate = wrapper.querySelector('#event-date').value;
    const eventTime = wrapper.querySelector('#event-time').value.trim();
    const capacity = parseInt(wrapper.querySelector('#event-capacity').value, 10) || 100;
    const description = wrapper.querySelector('#event-desc').value.trim();
    const submitBtn = wrapper.querySelector('#submit-event-btn');

    try {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Publishing...';

      const res = await api.createEvent({
        title,
        category,
        venue,
        eventDate,
        eventTime,
        capacity,
        description
      });

      showToast(res.message || 'Event published successfully!');
      formCard.style.display = 'none';
      wrapper.querySelector('#create-event-form').reset();
      await loadEvents();
    } catch (err) {
      showToast(err.message || 'Failed to publish event');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Publish Event';
    }
  });

  container.appendChild(wrapper);
}
