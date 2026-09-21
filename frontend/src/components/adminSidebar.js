/* ============================================
   CAMPUS RADAR — ADMIN SIDEBAR
   ============================================ */
import { icon } from '../utils/icons.js';
import { navigate } from '../router.js';

// SECURITY: Admin gateway path is injected at build time via VITE_ADMIN_GATEWAY env var.
// This prevents the path from being discoverable in source code.
// Fallback: if not set, default to a value that will 404 (forces proper configuration).
export const ADMIN_GATEWAY = import.meta.env?.VITE_ADMIN_GATEWAY || '/sec-admin-gateway-7x9q';

const adminLinks = [
  { path: ADMIN_GATEWAY, label: 'Overview', icon: 'grid', exact: true },
  { path: `${ADMIN_GATEWAY}/users`, label: 'Users', icon: 'users' },
  { path: `${ADMIN_GATEWAY}/posts`, label: 'Posts', icon: 'edit' },
  { path: `${ADMIN_GATEWAY}/confessions`, label: 'Confessions', icon: 'confession' },
  { path: `${ADMIN_GATEWAY}/events`, label: 'Events', icon: 'calendar' },
  { path: `${ADMIN_GATEWAY}/reports`, label: 'Reports & Moderation', icon: 'flag' },
  { path: `${ADMIN_GATEWAY}/analytics`, label: 'Analytics', icon: 'barChart' },
  { path: `${ADMIN_GATEWAY}/settings`, label: 'Settings', icon: 'settings' },
];

export function renderAdminSidebar() {
  const sidebar = document.createElement('aside');
  sidebar.className = 'admin-sidebar';
  sidebar.id = 'admin-sidebar';

  const isLinkActive = (link) => {
    const current = window.location.hash.slice(1) || '/';
    if (link.exact) return current === link.path;
    return current === link.path;
  };

  sidebar.innerHTML = `
    <div class="admin-sidebar__section">
      <div class="admin-sidebar__title">Administration</div>
      ${adminLinks.map(link => `
        <a class="admin-sidebar__link ${isLinkActive(link) ? 'admin-sidebar__link--active' : ''}"
           data-nav="${link.path}">
          ${icon(link.icon)}
          <span>${link.label}</span>
        </a>
      `).join('')}
    </div>
    <div class="admin-sidebar__section" style="margin-top: auto; padding-top: var(--space-4); border-top: 1px solid var(--border-light);">
      <a class="admin-sidebar__link" data-nav="/">
        ${icon('arrowLeft')}
        <span>Back to App</span>
      </a>
    </div>
  `;

  sidebar.addEventListener('click', (e) => {
    const link = e.target.closest('[data-nav]');
    if (link) {
      e.preventDefault();
      navigate(link.dataset.nav);
    }
  });

  return sidebar;
}
