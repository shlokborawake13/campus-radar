/* ============================================
   CAMPUS RADAR — HOME PAGE
   Live social feed connected to backend API
   High-performance progressive cursor feed
   ============================================ */
import { icon } from '../utils/icons.js';
import { getGreeting } from '../utils/helpers.js';
import { navigate } from '../router.js';
import { renderPostCard } from '../components/postCard.js';
import { api, tokenStorage } from '../services/api.js';

export function renderHome(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-wrapper';

  const user = tokenStorage.getUser();
  const userName = user ? (user.anonymousPseudonym || 'student') : 'student';

  wrapper.innerHTML = `
    <div class="page-content page-content--feed">
      <div class="home-hero anim-fade-in-up">
        <p class="eyebrow">${getGreeting()}, ${userName}.</p>
        <h1 class="heading-hero">What's happening<br>around campus?</h1>
      </div>

      <div class="home-search anim-fade-in-up" style="animation-delay: 100ms">
        <div class="search-bar">
          <span class="search-icon">${icon('search')}</span>
          <input type="text" class="input" placeholder="Search campus feed..." id="home-search" />
        </div>
      </div>

      <div class="create-prompt card anim-fade-in-up" style="animation-delay: 200ms" id="create-prompt">
        <div class="create-prompt__top">
          <div class="avatar avatar--sm" style="background: var(--accent-primary); color: white; font-weight: 700;">
            #
          </div>
          <div class="create-prompt__input">What's on your mind? Share with Sanjivani campus...</div>
        </div>
        <div class="create-prompt__actions">
          <button class="btn btn--secondary btn--sm" data-type="post">
            ${icon('edit')} Share Post
          </button>
          <button class="btn btn--secondary btn--sm" data-type="confession">
            ${icon('confession')} Post Confession
          </button>
          <button class="btn btn--secondary btn--sm" data-type="event">
            ${icon('calendar')} New Event
          </button>
        </div>
      </div>

      <div class="feed stagger-children" id="feed">
        <div class="loading-spinner-wrapper" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
          <p>Loading latest campus posts...</p>
        </div>
      </div>

      <div id="feed-sentinel" style="text-align: center; padding: var(--space-4); display: none;">
        <span style="color: var(--text-tertiary); font-size: var(--text-xs);">Loading more updates...</span>
      </div>
    </div>
  `;

  const feedEl = wrapper.querySelector('#feed');
  const sentinelEl = wrapper.querySelector('#feed-sentinel');

  let currentCursor = null;
  let hasMorePosts = false;
  let isLoading = false;
  let currentSearchQuery = '';

  async function loadPosts(query = '', isAppend = false) {
    if (isLoading) return;
    isLoading = true;

    if (!isAppend) {
      currentCursor = null;
      feedEl.innerHTML = `
        <div class="loading-spinner-wrapper" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
          <p>Loading latest campus posts...</p>
        </div>
      `;
    } else {
      sentinelEl.style.display = 'block';
    }

    try {
      const params = {};
      if (currentCursor) params.cursor = currentCursor;
      if (query.trim()) params.search = query.trim();

      const res = await api.getPosts(params);
      const posts = res.data || res.posts || [];
      currentCursor = res.nextCursor || null;
      hasMorePosts = !!res.hasMore;

      let filtered = posts;
      if (query.trim()) {
        const q = query.toLowerCase();
        filtered = posts.filter(p => p.content?.toLowerCase().includes(q) || p.author_name?.toLowerCase().includes(q));
      }

      if (!isAppend) {
        feedEl.innerHTML = '';
      }

      if (filtered.length === 0 && !isAppend) {
        feedEl.innerHTML = `
          <div class="card" style="text-align: center; padding: var(--space-12) var(--space-6); color: var(--text-secondary);">
            <div style="font-size: 2.5rem; margin-bottom: var(--space-3);">${icon('edit')}</div>
            <h3 class="heading-small" style="margin-bottom: var(--space-2);">No posts yet</h3>
            <p style="max-width: 360px; margin: 0 auto var(--space-6);">Be the first Sanjivani student to share updates, questions, or campus news!</p>
            <button class="btn btn--primary" id="first-post-btn">Create First Post</button>
          </div>
        `;
        feedEl.querySelector('#first-post-btn')?.addEventListener('click', () => navigate('/create'));
        sentinelEl.style.display = 'none';
        return;
      }

      filtered.forEach(post => {
        feedEl.appendChild(renderPostCard(post));
      });

      sentinelEl.style.display = hasMorePosts ? 'block' : 'none';
    } catch (err) {
      if (!isAppend) {
        feedEl.innerHTML = `
          <div class="card" style="text-align: center; padding: var(--space-8); color: var(--text-secondary);">
            <p style="color: var(--text-primary); margin-bottom: var(--space-2);">Could not connect to the campus server.</p>
            <p class="body-small" style="margin-bottom: var(--space-4);">${err.message || 'Make sure you are logged in.'}</p>
            <button class="btn btn--secondary btn--sm" id="retry-feed-btn">Retry</button>
          </div>
        `;
        feedEl.querySelector('#retry-feed-btn')?.addEventListener('click', () => loadPosts(currentSearchQuery));
      }
      sentinelEl.style.display = 'none';
    } finally {
      isLoading = false;
    }
  }

  // Initial load (page 1)
  loadPosts();

  // Progressive scroll observer
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMorePosts && !isLoading) {
      loadPosts(currentSearchQuery, true);
    }
  }, { rootMargin: '200px' });

  observer.observe(sentinelEl);

  // Search input filter
  const searchInput = wrapper.querySelector('#home-search');
  let debounceTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    currentSearchQuery = e.target.value;
    debounceTimeout = setTimeout(() => {
      loadPosts(currentSearchQuery, false);
    }, 250);
  });

  // Create prompt click
  wrapper.querySelector('#create-prompt').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (btn?.dataset.type === 'confession') {
      navigate('/confessions');
    } else if (btn?.dataset.type === 'event') {
      navigate('/events');
    } else {
      navigate('/create');
    }
  });

  container.appendChild(wrapper);
}
