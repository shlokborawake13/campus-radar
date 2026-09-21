/* ============================================
   CAMPUS RADAR — EVENT CARD COMPONENT
   ============================================ */
import { icon } from '../utils/icons.js';
import { formatDate, showToast } from '../utils/helpers.js';
import { api, tokenStorage } from '../services/api.js';
import { navigate } from '../router.js';

const categoryColors = {
  hackathon: { bg: 'var(--accent-blue-bg)', color: 'var(--color-info)', border: 'rgba(126,184,212,0.3)' },
  cultural: { bg: 'var(--accent-peach-bg)', color: '#C0705A', border: 'rgba(244,166,140,0.3)' },
  workshop: { bg: 'var(--accent-lavender-bg)', color: '#7B6BA0', border: 'rgba(184,169,212,0.3)' },
  sports: { bg: 'var(--accent-yellow-bg)', color: '#B8960A', border: 'rgba(232,201,110,0.3)' },
  seminar: { bg: 'var(--accent-blue-bg)', color: '#2563EB', border: 'rgba(37,99,235,0.3)' },
  general: { bg: 'var(--accent-lavender-bg)', color: '#6B7280', border: 'rgba(107,114,128,0.3)' }
};

const imageGradients = {
  hackathon: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
  cultural: 'linear-gradient(135deg, #F093FB 0%, #F5576C 100%)',
  workshop: 'linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)',
  sports: 'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)',
  seminar: 'linear-gradient(135deg, #FA709A 0%, #FEE140 100%)',
  general: 'linear-gradient(135deg, #A18CD1 0%, #FBC2EB 100%)'
};

export function renderEventCard(event) {
  const category = (event.category || 'general').toLowerCase();
  const catStyle = categoryColors[category] || categoryColors.general;
  const gradient = imageGradients[category] || imageGradients.general;
  
  const capacity = parseInt(event.capacity ?? event.maxCapacity ?? 100, 10);
  let registeredCount = parseInt(event.registrations_count ?? event.registered ?? 0, 10);
  let isRegistered = !!(event.is_registered ?? event.isRegistered);
  let spotsLeft = Math.max(0, capacity - registeredCount);
  let fillPercent = Math.min(100, Math.round((registeredCount / capacity) * 100));

  const eventDate = event.event_date || event.eventDate || event.date;
  const eventTime = event.event_time || event.eventTime || 'TBD';
  const venue = event.venue || event.location || 'Sanjivani Campus';
  const organizerName = event.organizer_name || event.organizerName || 'Campus Committee';

  const card = document.createElement('article');
  card.className = 'card event-card';
  card.id = `event-${event.id}`;

  card.innerHTML = `
    <div class="event-card__image" style="background: ${event.banner_url ? `url(${event.banner_url}) center/cover` : gradient}; min-height: 140px; position: relative; border-radius: var(--radius-md) var(--radius-md) 0 0;">
      <span class="event-card__category" style="position: absolute; top: 12px; left: 12px; background: ${catStyle.bg}; color: ${catStyle.color}; border: 1px solid ${catStyle.border}; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: capitalize;">
        ${category}
      </span>
    </div>

    <div class="event-card__body" style="padding: var(--space-4);">
      <h3 class="event-card__title" style="margin-bottom: var(--space-1);">${event.title}</h3>
      <p class="event-card__dept" style="color: var(--text-tertiary); font-size: var(--text-xs); margin-bottom: var(--space-2);">By ${organizerName}</p>
      <p class="event-card__desc" style="color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.5; margin-bottom: var(--space-4);">${event.description}</p>

      <div class="event-card__details" style="display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4); font-size: var(--text-xs); color: var(--text-secondary);">
        <div class="event-card__detail" style="display: flex; align-items: center; gap: var(--space-2);">
          ${icon('calendar')}
          <span>${eventDate ? formatDate(eventDate) : 'Upcoming'}</span>
        </div>
        <div class="event-card__detail" style="display: flex; align-items: center; gap: var(--space-2);">
          ${icon('clock')}
          <span>${eventTime}</span>
        </div>
        <div class="event-card__detail" style="display: flex; align-items: center; gap: var(--space-2);">
          ${icon('mapPin')}
          <span>${venue}</span>
        </div>
      </div>

      <div class="event-card__footer" style="display: flex; justify-content: space-between; align-items: center; padding-top: var(--space-3); border-top: 1px solid var(--border-light);">
        <div class="event-card__capacity" style="flex: 1; margin-right: var(--space-4);">
          <div class="event-card__bar" style="height: 6px; background: var(--bg-secondary); border-radius: 3px; overflow: hidden; margin-bottom: 4px;">
            <div class="event-card__bar-fill" style="height: 100%; width: ${fillPercent}%; background: var(--accent-primary);"></div>
          </div>
          <span class="event-card__spots" style="font-size: 11px; color: var(--text-tertiary);">${spotsLeft} spots remaining</span>
        </div>
        <button class="btn ${isRegistered ? 'btn--secondary' : 'btn--primary'} btn--sm event-card__register" ${isRegistered || spotsLeft === 0 ? 'disabled' : ''}>
          ${isRegistered ? 'Registered ✓' : spotsLeft === 0 ? 'Full' : 'Register'}
        </button>
      </div>
    </div>
  `;

  const registerBtn = card.querySelector('.event-card__register');
  registerBtn.addEventListener('click', async () => {
    const user = tokenStorage.getUser();
    if (!user) {
      showToast('Please sign in to register for events');
      navigate('/login');
      return;
    }

    try {
      registerBtn.disabled = true;
      registerBtn.textContent = 'Registering...';

      const res = await api.registerEvent(event.id);
      showToast(res.message || `Registered for ${event.title}!`);
      
      registeredCount += 1;
      spotsLeft = Math.max(0, capacity - registeredCount);
      fillPercent = Math.min(100, Math.round((registeredCount / capacity) * 100));

      card.querySelector('.event-card__bar-fill').style.width = `${fillPercent}%`;
      card.querySelector('.event-card__spots').textContent = `${spotsLeft} spots remaining`;

      registerBtn.textContent = 'Registered ✓';
      registerBtn.classList.remove('btn--primary');
      registerBtn.classList.add('btn--secondary');
    } catch (err) {
      showToast(err.message || 'Registration failed');
      registerBtn.disabled = false;
      registerBtn.textContent = 'Register';
    }
  });

  return card;
}
