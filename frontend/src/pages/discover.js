/* ============================================
   CAMPUS RADAR — DISCOVER PAGE
   Live Exploration Hub across posts, confessions & events
   ============================================ */
import { icon } from '../utils/icons.js';
import { renderPostCard } from '../components/postCard.js';
import { renderConfessionCard } from '../components/confessionCard.js';
import { renderEventCard } from '../components/eventCard.js';
import { api } from '../services/api.js';

export function renderDiscover(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-wrapper';

  wrapper.innerHTML = `
    <div class="page-content">
      <div class="section-header anim-fade-in-up">
        <p class="eyebrow">Discover</p>
        <h1 class="heading-hero">Explore what's<br>happening around you.</h1>
      </div>

      <div class="discover-search anim-fade-in-up" style="max-width: 540px; margin: 0 auto var(--space-12);">
        <div class="search-bar">
          <span class="search-icon">${icon('search')}</span>
          <input type="text" class="input input--lg" placeholder="Search campus topics..." id="discover-search-input" />
        </div>
      </div>

      <section class="discover-section anim-fade-in-up" style="margin-bottom: var(--space-12);">
        <div class="discover-section__header">
          <h2 class="heading-section">Trending Posts</h2>
          <span class="body-small">${icon('trending')} Most active</span>
        </div>
        <div class="discover-section__scroll" id="discover-trending-posts">
          <div style="color: var(--text-tertiary); font-size: var(--text-sm); padding: var(--space-4);">Loading trending posts...</div>
        </div>
      </section>

      <section class="discover-section anim-fade-in-up" style="margin-bottom: var(--space-12);">
        <div class="discover-section__header">
          <h2 class="heading-section">Popular Confessions</h2>
          <span class="body-small">${icon('fire')} Top rated</span>
        </div>
        <div class="discover-section__scroll" id="discover-confessions">
          <div style="color: var(--text-tertiary); font-size: var(--text-sm); padding: var(--space-4);">Loading popular confessions...</div>
        </div>
      </section>

      <section class="discover-section anim-fade-in-up" style="margin-bottom: var(--space-12);">
        <div class="discover-section__header">
          <h2 class="heading-section">Upcoming Events</h2>
          <span class="body-small">${icon('calendar')} Don't miss out</span>
        </div>
        <div class="discover-events-grid" id="discover-events">
          <div style="grid-column: 1/-1; color: var(--text-tertiary); font-size: var(--text-sm); padding: var(--space-4);">Loading events...</div>
        </div>
      </section>
    </div>
  `;

  const trendingPostsContainer = wrapper.querySelector('#discover-trending-posts');
  const confessionsContainer = wrapper.querySelector('#discover-confessions');
  const eventsContainer = wrapper.querySelector('#discover-events');

  async function loadDiscoverData() {
    try {
      const [trendingRes, confRes, eventsRes] = await Promise.all([
        api.getTrending().catch(() => ({ trending: [] })),
        api.getConfessions().catch(() => ({ data: [] })),
        api.getEvents().catch(() => ({ events: [] }))
      ]);

      // Trending posts
      const posts = trendingRes.trending || [];
      trendingPostsContainer.innerHTML = '';
      if (posts.length === 0) {
        trendingPostsContainer.innerHTML = '<div style="color: var(--text-tertiary); font-size: var(--text-sm); padding: var(--space-4);">No trending posts yet.</div>';
      } else {
        posts.slice(0, 4).forEach(post => {
          trendingPostsContainer.appendChild(renderPostCard(post));
        });
      }

      // Popular confessions
      const confessions = (confRes.data || confRes.confessions || []).sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
      confessionsContainer.innerHTML = '';
      if (confessions.length === 0) {
        confessionsContainer.innerHTML = '<div style="color: var(--text-tertiary); font-size: var(--text-sm); padding: var(--space-4);">No confessions yet.</div>';
      } else {
        confessions.slice(0, 4).forEach((c, i) => {
          confessionsContainer.appendChild(renderConfessionCard(c, i));
        });
      }

      // Events
      const eventsList = eventsRes.events || eventsRes.data || [];
      eventsContainer.innerHTML = '';
      if (eventsList.length === 0) {
        eventsContainer.innerHTML = '<div style="grid-column: 1/-1; color: var(--text-tertiary); font-size: var(--text-sm); padding: var(--space-4);">No upcoming events scheduled.</div>';
      } else {
        eventsList.slice(0, 3).forEach(event => {
          eventsContainer.appendChild(renderEventCard(event));
        });
      }
    } catch {}
  }

  loadDiscoverData();

  container.appendChild(wrapper);
}
