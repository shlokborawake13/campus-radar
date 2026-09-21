/* ============================================
   CAMPUS RADAR — TRENDING PAGE
   Server-calculated engagement and recency feed
   ============================================ */
import { renderPostCard } from '../components/postCard.js';
import { renderConfessionCard } from '../components/confessionCard.js';
import { api } from '../services/api.js';

export function renderTrending(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-wrapper';

  wrapper.innerHTML = `
    <div class="page-content page-content--feed">
      <div class="section-header anim-fade-in-up">
        <p class="eyebrow">Campus Radar Trending</p>
        <h1 class="heading-hero">What's getting attention<br>around campus.</h1>
        <p class="body-text">Calculated live based on engagement, conversations, and recency.</p>
      </div>

      <div class="tabs anim-fade-in-up" id="trending-tabs" style="margin-bottom: var(--space-6);">
        <button class="tab tab--active" data-tab="all">All Trending</button>
        <button class="tab" data-tab="posts">Trending Posts</button>
        <button class="tab" data-tab="confessions">Top Confessions</button>
      </div>

      <div class="feed stagger-children" id="trending-feed">
        <div class="loading-spinner-wrapper" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
          <p>Loading trending topics...</p>
        </div>
      </div>
    </div>
  `;

  const feedEl = wrapper.querySelector('#trending-feed');
  const tabs = wrapper.querySelector('#trending-tabs');
  let currentTab = 'all';

  async function loadTrending() {
    feedEl.innerHTML = `
      <div class="loading-spinner-wrapper" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
        <p>Calculating trending campus discussions...</p>
      </div>
    `;

    try {
      const [trendingRes, confessionsRes] = await Promise.all([
        api.getTrending().catch(() => ({ trending: [] })),
        (currentTab === 'all' || currentTab === 'confessions') ? api.getConfessions().catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      ]);

      const trendingPosts = trendingRes.trending || [];
      const topConfessions = (confessionsRes.data || confessionsRes.confessions || []).sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));

      feedEl.innerHTML = '';

      if (currentTab === 'all' || currentTab === 'posts') {
        trendingPosts.forEach(post => {
          feedEl.appendChild(renderPostCard(post));
        });
      }

      if (currentTab === 'all' || currentTab === 'confessions') {
        topConfessions.slice(0, 5).forEach((c, i) => {
          feedEl.appendChild(renderConfessionCard(c, i));
        });
      }

      if (feedEl.children.length === 0) {
        feedEl.innerHTML = `
          <div class="card" style="text-align: center; padding: var(--space-12) var(--space-6); color: var(--text-secondary);">
            <h3 class="heading-small" style="margin-bottom: var(--space-2);">No trending topics yet</h3>
            <p style="max-width: 380px; margin: 0 auto;">Trending posts and confessions appear here once discussions gain traction on campus.</p>
          </div>
        `;
      }
    } catch (err) {
      feedEl.innerHTML = `
        <div class="card" style="text-align: center; padding: var(--space-8); color: var(--text-secondary);">
          <p style="color: var(--text-primary); margin-bottom: var(--space-2);">Could not calculate trending topics.</p>
          <p class="body-small" style="margin-bottom: var(--space-4);">${err.message || 'Please log in to view trending topics.'}</p>
          <button class="btn btn--secondary btn--sm" id="retry-trending-btn">Retry</button>
        </div>
      `;
      feedEl.querySelector('#retry-trending-btn')?.addEventListener('click', () => loadTrending());
    }
  }

  loadTrending();

  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('tab--active'));
    tab.classList.add('tab--active');
    currentTab = tab.dataset.tab;
    loadTrending();
  });

  container.appendChild(wrapper);
}
