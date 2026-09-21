/* ============================================
   CAMPUS RADAR — MAIN ENTRY POINT
   Fast startup, dynamic route-splitting, zero admin leakage
   ============================================ */
import { route, startRouter, navigate } from './router.js';
import { renderNavbar, updateNavbar } from './components/navbar.js';
import { renderBottomNav, updateBottomNav } from './components/bottomNav.js';
import { ADMIN_GATEWAY } from './utils/constants.js';
import { initTheme } from './utils/theme.js';
import { api, tokenStorage } from './services/api.js';

// Eager core page for instant homepage render
import { renderHome } from './pages/home.js';

const app = document.getElementById('app');

/** Render a student page with nav chrome */
function renderStudentPage(pageRenderer) {
  app.innerHTML = '';
  app.appendChild(renderNavbar());
  const contentArea = document.createElement('main');
  contentArea.id = 'page-content';
  pageRenderer(contentArea);
  app.appendChild(contentArea);
  app.appendChild(renderBottomNav());
  updateNavbar();
  updateBottomNav();
  window.scrollTo(0, 0);
}

/** Lazy-load and render a student page */
function lazyStudent(importFn) {
  return async () => {
    try {
      const module = await importFn();
      const renderer = Object.values(module).find(fn => typeof fn === 'function');
      if (renderer) {
        renderStudentPage(renderer);
      }
    } catch (err) {
      console.error('Failed to load page:', err);
    }
  };
}

/** Render an auth page (no nav) */
function renderAuthPage(pageRenderer) {
  app.innerHTML = '';
  const contentArea = document.createElement('main');
  contentArea.id = 'page-content';
  pageRenderer(contentArea);
  app.appendChild(contentArea);
  window.scrollTo(0, 0);
}

/** Lazy-load and render an auth/public page */
function lazyAuth(importFn) {
  return async () => {
    try {
      const module = await importFn();
      const renderer = Object.values(module).find(fn => typeof fn === 'function');
      if (renderer) {
        renderAuthPage(renderer);
      }
    } catch (err) {
      console.error('Failed to load page:', err);
    }
  };
}

async function renderAdminView(pageRenderer) {
  app.innerHTML = '';
  app.appendChild(renderNavbar());

  const layout = document.createElement('div');
  layout.className = 'admin-layout';
  
  const { renderAdminSidebar } = await import('./components/adminSidebar.js');
  layout.appendChild(renderAdminSidebar());

  const mainContent = document.createElement('main');
  mainContent.className = 'admin-main';
  mainContent.id = 'admin-main';
  if (pageRenderer) pageRenderer(mainContent);
  layout.appendChild(mainContent);

  app.appendChild(layout);
  updateNavbar();
  window.scrollTo(0, 0);
}

/** Lazy-load and render an admin page with isolated admin sidebar */
function lazyAdmin(importFn) {
  return async () => {
    const user = tokenStorage.getUser();
    const token = tokenStorage.getAccessToken();

    if (!token) {
      navigate('/login');
      return;
    }

    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    if (!isAdmin) {
      // Check server authorization just in case DB role was recently updated
      app.innerHTML = '';
      const loadingEl = document.createElement('main');
      loadingEl.className = 'page-content';
      loadingEl.innerHTML = `
        <div style="text-align: center; padding: var(--space-16) var(--space-4);">
          <p style="color: var(--text-secondary);">Verifying administrator authorization...</p>
        </div>
      `;
      app.appendChild(loadingEl);

      try {
        const res = await api.getProfile('me');
        if (res?.profile?.role === 'admin' || res?.profile?.role === 'super_admin') {
          const updated = {
            ...user,
            role: res.profile.role,
            anonymousPseudonym: res.profile.anonymous_pseudonym || user?.anonymousPseudonym,
            fullName: res.profile.full_name || user?.fullName,
            department: res.profile.department !== undefined ? res.profile.department : user?.department
          };
          tokenStorage.setUser(updated);
          const module = await importFn();
          const renderer = Object.values(module).find(fn => typeof fn === 'function');
          return renderAdminView(renderer);
        } else {
          const { renderNotFound } = await import('./pages/notFound.js');
          renderAuthPage(renderNotFound);
          return;
        }
      } catch {
        const { renderNotFound } = await import('./pages/notFound.js');
        renderAuthPage(renderNotFound);
        return;
      }
    }

    const module = await importFn();
    const renderer = Object.values(module).find(fn => typeof fn === 'function');
    renderAdminView(renderer);
  };
}


// ---- Register Routes ----

// Student routes (Home is eager for instant first paint, other routes lazy)
route('/', () => renderStudentPage(renderHome));
route('/trending', lazyStudent(() => import('./pages/trending.js')));
route('/confessions', lazyStudent(() => import('./pages/confessions.js')));
route('/events', lazyStudent(() => import('./pages/events.js')));
route('/discover', lazyStudent(() => import('./pages/discover.js')));
route('/saved', lazyStudent(() => import('./pages/saved.js')));
route('/profile', lazyStudent(() => import('./pages/profile.js')));
route('/profile/settings', lazyStudent(() => import('./pages/profileSettings.js')));

// Create post modal (dynamic import)
route('/create', async () => {
  const existing = document.getElementById('create-post-modal');
  if (existing) return;
  const { renderCreatePostModal } = await import('./components/createPostModal.js');
  renderCreatePostModal(app);
});

// Auth routes (lazy)
route('/login', lazyAuth(() => import('./pages/login.js')));
route('/register', lazyAuth(() => import('./pages/register.js')));
route('/verify-email', lazyAuth(() => import('./pages/verifyEmail.js')));

// Public decoy /admin routes return 404 for everyone (conceals admin presence)
route('/admin', lazyAuth(() => import('./pages/notFound.js')));
route('/admin/users', lazyAuth(() => import('./pages/notFound.js')));
route('/admin/posts', lazyAuth(() => import('./pages/notFound.js')));
route('/admin/confessions', lazyAuth(() => import('./pages/notFound.js')));
route('/admin/events', lazyAuth(() => import('./pages/notFound.js')));
route('/admin/reports', lazyAuth(() => import('./pages/notFound.js')));
route('/admin/analytics', lazyAuth(() => import('./pages/notFound.js')));
route('/admin/settings', lazyAuth(() => import('./pages/notFound.js')));

// Private admin gateway routes (dynamically loaded only on authorized admin access)
route(ADMIN_GATEWAY, lazyAdmin(() => import('./pages/admin/dashboard.js')));
route(`${ADMIN_GATEWAY}/users`, lazyAdmin(() => import('./pages/admin/users.js')));
route(`${ADMIN_GATEWAY}/posts`, lazyAdmin(() => import('./pages/admin/posts.js')));
route(`${ADMIN_GATEWAY}/confessions`, lazyAdmin(() => import('./pages/admin/confessions.js')));
route(`${ADMIN_GATEWAY}/events`, lazyAdmin(() => import('./pages/admin/events.js')));
route(`${ADMIN_GATEWAY}/reports`, lazyAdmin(() => import('./pages/admin/reports.js')));
route(`${ADMIN_GATEWAY}/analytics`, lazyAdmin(() => import('./pages/admin/analytics.js')));
route(`${ADMIN_GATEWAY}/settings`, lazyAdmin(() => Promise.resolve({
  render: (el) => {
    el.innerHTML = `
      <div class="anim-fade-in-up">
        <p class="eyebrow">Configuration</p>
        <h1 class="heading-section">Settings</h1>
        <div class="card" style="margin-top: var(--space-6);">
          <h3 class="heading-small" style="margin-bottom: var(--space-4);">Platform Settings</h3>
          <div class="input-group" style="margin-bottom: var(--space-4);">
            <label class="input-label">Platform Name</label>
            <input type="text" class="input" value="Campus Radar" />
          </div>
          <div class="input-group" style="margin-bottom: var(--space-4);">
            <label class="input-label">Allowed Email Domain</label>
            <input type="text" class="input" value="@sanjivani.edu.in" readonly style="background: var(--bg-secondary);" />
          </div>
          <div class="input-group" style="margin-bottom: var(--space-4);">
            <label class="input-label">Max Post Length</label>
            <input type="number" class="input" value="500" />
          </div>
          <button class="btn btn--primary">Save Settings</button>
        </div>
      </div>
    `;
  }
})));

// Catch-all route for any undefined paths (must be registered last)
route('*', lazyAuth(() => import('./pages/notFound.js')));

// Initialize theme (apply before first render to prevent flash)
initTheme();

// Start router
startRouter();

// Synchronize profile & role in background if user is logged in
if (tokenStorage.getAccessToken()) {
  api.getProfile('me').then(res => {
    if (res?.profile?.role) {
      const current = tokenStorage.getUser() || {};
      const oldRole = current.role;
      const updated = {
        ...current,
        role: res.profile.role,
        anonymousPseudonym: res.profile.anonymous_pseudonym || current.anonymousPseudonym,
        fullName: res.profile.full_name || current.fullName,
        department: res.profile.department !== undefined ? res.profile.department : current.department
      };
      tokenStorage.setUser(updated);
      updateNavbar();
      if (oldRole !== updated.role && window.location.hash.includes('profile')) {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    }
  }).catch(() => {});
}
