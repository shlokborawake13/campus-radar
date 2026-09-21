/* ============================================
   CAMPUS RADAR — PROFILE PAGE
   Authenticated student profile & my posts
   ============================================ */
import { icon } from '../utils/icons.js';
import { navigate } from '../router.js';
import { renderPostCard } from '../components/postCard.js';
import { api, tokenStorage } from '../services/api.js';
import { showToast } from '../utils/helpers.js';
import { ADMIN_GATEWAY } from '../utils/constants.js';

export function renderProfile(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-wrapper';

  const token = tokenStorage.getAccessToken();
  const localUser = token ? tokenStorage.getUser() : null;
  const isAdmin = localUser?.role === 'admin' || localUser?.role === 'super_admin';

  if (!localUser || !token) {
    tokenStorage.clearTokens();
    wrapper.innerHTML = `
      <div class="page-content page-content--feed">
        <div class="card" style="text-align: center; padding: var(--space-12) var(--space-6);">
          <h2 class="heading-section" style="margin-bottom: var(--space-2);">Sign in to Campus Radar</h2>
          <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">Your profile, posts, and bookmarks require authentication.</p>
          <div style="display: flex; justify-content: center; gap: var(--space-3);">
            <button class="btn btn--primary" id="go-login-btn">Sign In</button>
            <button class="btn btn--secondary" id="go-reg-btn">Create Account</button>
          </div>
        </div>
      </div>
    `;
    wrapper.querySelector('#go-login-btn')?.addEventListener('click', () => navigate('/login'));
    wrapper.querySelector('#go-reg-btn')?.addEventListener('click', () => navigate('/register'));
    container.appendChild(wrapper);
    return;
  }

  wrapper.innerHTML = `
    <div class="page-content page-content--feed">
      <div class="profile-header anim-fade-in-up">
        <div class="avatar avatar--xl" style="background: var(--accent-primary); color: white; font-size: 2rem; font-weight: 700;">
          #
        </div>
        <h1 class="heading-section" style="margin-top: var(--space-4);" id="profile-name">${localUser.anonymousPseudonym || 'Anonymous Student'}</h1>
        <p class="body-text" style="color: var(--text-secondary);" id="profile-dept">
          Private Account • ${localUser.email}
        </p>
        <p class="body-small" style="color: var(--text-tertiary);" id="profile-meta">
          ${isAdmin ? '<span class="badge" style="background: rgba(224,90,71,0.15); color: #E05A47; border: 1px solid rgba(224,90,71,0.3); font-weight: 600; font-size: 12px; padding: 4px 10px;">👑 Verified University Administrator</span>' : 'Verified Sanjivani Student'}
        </p>

        <div class="profile-stats" id="profile-stats">
          <div class="profile-stat">
            <span class="profile-stat__value" id="stat-posts">0</span>
            <span class="profile-stat__label">My Posts</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat__value" id="stat-rep">100</span>
            <span class="profile-stat__label">Reputation</span>
          </div>
        </div>

        <div class="profile-actions" style="margin-top: var(--space-6); display: flex; gap: var(--space-3); justify-content: center; flex-wrap: wrap;">
          ${isAdmin ? `
            <button class="btn btn--primary btn--sm" data-nav="${ADMIN_GATEWAY}" id="admin-console-btn" style="background: linear-gradient(135deg, #E05A47, #F57C60); border: none;">
              ${icon('grid')} Admin Console
            </button>
          ` : ''}
          <button class="btn btn--secondary btn--sm" data-nav="/profile/settings">
            ${icon('settings')} Edit Profile
          </button>
          <button class="btn btn--secondary btn--sm" data-nav="/saved">
            ${icon('bookmark')} Saved
          </button>
          <button class="btn btn--ghost btn--sm" id="logout-btn" style="color: var(--color-error);">
            ${icon('logOut')} Sign Out
          </button>
        </div>
      </div>

      <hr class="divider" style="margin: var(--space-8) 0;" />

      <h2 class="heading-small" style="margin-bottom: var(--space-4);">My Published Posts</h2>
      <div class="feed stagger-children" id="profile-feed">
        <div class="loading-spinner-wrapper" style="text-align: center; padding: var(--space-6); color: var(--text-tertiary);">
          <p>Loading your posts...</p>
        </div>
      </div>
    </div>
  `;

  const feedEl = wrapper.querySelector('#profile-feed');

  async function loadProfileData() {
    try {
      const res = await api.getProfile('me');
      const profile = res.profile || {};
      const recentPosts = res.recentPosts || [];

      if (profile.anonymous_pseudonym) {
        wrapper.querySelector('#profile-name').innerText = profile.anonymous_pseudonym;
      }
      if (profile.reputation_score !== undefined) {
        wrapper.querySelector('#stat-rep').innerText = profile.reputation_score;
      }
      wrapper.querySelector('#stat-posts').innerText = recentPosts.length;

      // Synchronize latest live user attributes (including role change) into tokenStorage
      if (profile.role) {
        const updated = {
          ...localUser,
          role: profile.role,
          anonymousPseudonym: profile.anonymous_pseudonym || localUser.anonymousPseudonym,
          fullName: profile.full_name || localUser.fullName,
          department: profile.department !== undefined ? profile.department : localUser.department
        };
        tokenStorage.setUser(updated);

        const isNowAdmin = updated.role === 'admin' || updated.role === 'super_admin';
        const metaEl = wrapper.querySelector('#profile-meta');
        if (metaEl) {
          metaEl.innerHTML = isNowAdmin 
            ? '<span class="badge" style="background: rgba(224,90,71,0.15); color: #E05A47; border: 1px solid rgba(224,90,71,0.3); font-weight: 600; font-size: 12px; padding: 4px 10px;">👑 Verified University Administrator</span>'
            : 'Verified Sanjivani Student';
        }

        const actionsEl = wrapper.querySelector('.profile-actions');
        if (isNowAdmin && actionsEl && !wrapper.querySelector('#admin-console-btn')) {
          const adminBtn = document.createElement('button');
          adminBtn.className = 'btn btn--primary btn--sm';
          adminBtn.id = 'admin-console-btn';
          adminBtn.dataset.nav = ADMIN_GATEWAY;
          adminBtn.style.cssText = 'background: linear-gradient(135deg, #E05A47, #F57C60); border: none;';
          adminBtn.innerHTML = `${icon('grid')} Admin Console`;
          actionsEl.prepend(adminBtn);
        }
      }

      feedEl.innerHTML = '';
      if (recentPosts.length === 0) {
        feedEl.innerHTML = `
          <div class="card" style="text-align: center; padding: var(--space-8) var(--space-4); color: var(--text-secondary);">
            <p style="margin-bottom: var(--space-4);">You haven't posted anything to the campus feed yet.</p>
            <button class="btn btn--primary btn--sm" id="make-first-post">Share a Post</button>
          </div>
        `;
        feedEl.querySelector('#make-first-post')?.addEventListener('click', () => navigate('/create'));
        return;
      }

      recentPosts.forEach(post => {
        feedEl.appendChild(renderPostCard(post));
      });
    } catch (err) {
      feedEl.innerHTML = `
        <div class="card" style="text-align: center; padding: var(--space-6); color: var(--text-secondary);">
          <p class="body-small">${err.message || 'Could not load your posts.'}</p>
        </div>
      `;
    }
  }

  loadProfileData();

  // Navigation handlers
  wrapper.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) navigate(navBtn.dataset.nav);
  });

  // Logout
  wrapper.querySelector('#logout-btn')?.addEventListener('click', async () => {
    try {
      await api.logout();
    } catch {}
    tokenStorage.clearTokens();
    showToast('Signed out of Campus Radar');
    navigate('/login');
  });

  container.appendChild(wrapper);
}
