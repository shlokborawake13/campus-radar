/* ============================================
   CAMPUS RADAR — SAVED PAGE
   Bookmarked posts and resources
   ============================================ */
import { renderPostCard } from '../components/postCard.js';
import { api, tokenStorage } from '../services/api.js';
import { icon } from '../utils/icons.js';
import { navigate } from '../router.js';

export function renderSaved(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-wrapper';

  wrapper.innerHTML = `
    <div class="page-content page-content--feed">
      <div class="section-header anim-fade-in-up">
        <p class="eyebrow">Bookmarks</p>
        <h1 class="heading-hero">Your saved posts.</h1>
        <p class="body-text">Campus news, updates, and resources you bookmarked to revisit.</p>
      </div>

      <div class="feed stagger-children" id="saved-feed">
        <div class="loading-spinner-wrapper" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
          <p>Loading your saved posts...</p>
        </div>
      </div>
    </div>
  `;

  const feedEl = wrapper.querySelector('#saved-feed');

  async function loadSaved() {
    const user = tokenStorage.getUser();
    if (!user) {
      feedEl.innerHTML = `
        <div class="card" style="text-align: center; padding: var(--space-12) var(--space-6); color: var(--text-secondary);">
          <h3 class="heading-small" style="margin-bottom: var(--space-2);">Sign in to view saved items</h3>
          <p style="margin-bottom: var(--space-4);">Your bookmarked posts are synced with your student account.</p>
          <button class="btn btn--primary" id="saved-login-btn">Sign In</button>
        </div>
      `;
      feedEl.querySelector('#saved-login-btn')?.addEventListener('click', () => navigate('/login'));
      return;
    }

    try {
      const res = await api.getSavedPosts();
      const savedList = res.saved || res.data || [];

      feedEl.innerHTML = '';
      if (savedList.length === 0) {
        feedEl.innerHTML = `
          <div class="card" style="text-align: center; padding: var(--space-12) var(--space-6); color: var(--text-secondary);">
            <div style="font-size: 2.5rem; margin-bottom: var(--space-3);">${icon('bookmark')}</div>
            <h3 class="heading-small" style="margin-bottom: var(--space-2);">No saved posts yet</h3>
            <p style="max-width: 360px; margin: 0 auto var(--space-6);">Click the bookmark icon on any post in your feed to save it here for quick access.</p>
            <button class="btn btn--primary" id="browse-feed-btn">Explore Feed</button>
          </div>
        `;
        feedEl.querySelector('#browse-feed-btn')?.addEventListener('click', () => navigate('/'));
        return;
      }

      savedList.forEach(post => {
        feedEl.appendChild(renderPostCard(post));
      });
    } catch (err) {
      feedEl.innerHTML = `
        <div class="card" style="text-align: center; padding: var(--space-8); color: var(--text-secondary);">
          <p style="color: var(--text-primary); margin-bottom: var(--space-2);">Could not load saved posts.</p>
          <p class="body-small" style="margin-bottom: var(--space-4);">${err.message || 'Please verify your session.'}</p>
          <button class="btn btn--secondary btn--sm" id="retry-saved-btn">Retry</button>
        </div>
      `;
      feedEl.querySelector('#retry-saved-btn')?.addEventListener('click', () => loadSaved());
    }
  }

  loadSaved();
  container.appendChild(wrapper);
}
