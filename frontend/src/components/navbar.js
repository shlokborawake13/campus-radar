/* ============================================
   CAMPUS RADAR — DESKTOP NAVBAR
   ============================================ */
import { icon } from '../utils/icons.js';
import { navigate, isActive } from '../router.js';
import { toggleTheme, getTheme } from '../utils/theme.js';
import { tokenStorage } from '../services/api.js';

import { ADMIN_GATEWAY } from '../utils/constants.js';

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/trending', label: 'Trending' },
  { path: '/confessions', label: 'Confessions' },
  { path: '/events', label: 'Events' },
  { path: '/discover', label: 'Discover' },
];

function themeToggleHTML() {
  const isDark = getTheme() === 'dark';
  return `
    <button class="navbar__icon-btn theme-toggle" aria-label="Toggle dark mode" id="theme-toggle">
      <span class="theme-toggle__sun" style="position:absolute; opacity:${isDark ? 1 : 0}; transform:rotate(${isDark ? '0deg' : '-90deg'}) scale(${isDark ? 1 : 0.5}); transition: all 350ms cubic-bezier(0.34,1.56,0.64,1);">
        ${icon('sun')}
      </span>
      <span class="theme-toggle__moon" style="position:absolute; opacity:${isDark ? 0 : 1}; transform:rotate(${isDark ? '90deg' : '0deg'}) scale(${isDark ? 0.5 : 1}); transition: all 350ms cubic-bezier(0.34,1.56,0.64,1);">
        ${icon('moon')}
      </span>
    </button>
  `;
}

export function renderNavbar() {
  const nav = document.createElement('header');
  nav.className = 'navbar';
  nav.id = 'main-navbar';

  const user = tokenStorage.getUser();
  const initial = user ? '#' : 'U';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  nav.innerHTML = `
    <div class="navbar__inner">
      <a class="navbar__logo" data-nav="/" style="cursor: pointer;">Campus <span>Radar</span></a>

      <nav class="navbar__nav hide-mobile" aria-label="Main navigation">
        ${navLinks.map(link => `
          <a class="navbar__link ${isActive(link.path) ? 'navbar__link--active' : ''}"
             data-nav="${link.path}">${link.label}</a>
        `).join('')}
      </nav>

      <div class="navbar__actions">
        ${isAdmin ? `
          <button class="btn btn--secondary btn--sm hide-mobile navbar__admin-btn" data-nav="${ADMIN_GATEWAY}" style="border-color: rgba(224,90,71,0.5); color: #E05A47; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
            ${icon('shield')} Admin
          </button>
        ` : ''}
        <button class="navbar__icon-btn hide-mobile" aria-label="Search" data-nav="/discover">
          ${icon('search')}
        </button>
        ${themeToggleHTML()}
        <button class="navbar__icon-btn" aria-label="Profile" data-nav="/profile">
          <div class="avatar avatar--sm" style="background: var(--accent-primary); color: white; font-weight: 600;">${initial}</div>
        </button>
        <button class="btn btn--primary btn--sm hide-mobile" data-nav="/create">
          ${icon('plus')} Create Post
        </button>
      </div>
    </div>
  `;

  // Theme toggle click
  const themeBtn = nav.querySelector('#theme-toggle');
  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTheme();
  });

  // Navigation click handlers
  nav.addEventListener('click', (e) => {
    const link = e.target.closest('[data-nav]');
    if (link) {
      e.preventDefault();
      navigate(link.dataset.nav);
    }
  });

  return nav;
}

export function updateNavbar() {
  const links = document.querySelectorAll('.navbar__link');
  links.forEach(link => {
    const path = link.dataset.nav;
    link.classList.toggle('navbar__link--active', isActive(path));
  });

  const user = tokenStorage.getUser();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const actionsEl = document.querySelector('.navbar__actions');
  if (actionsEl) {
    let adminBtn = actionsEl.querySelector('.navbar__admin-btn');
    if (isAdmin && !adminBtn) {
      adminBtn = document.createElement('button');
      adminBtn.className = 'btn btn--secondary btn--sm hide-mobile navbar__admin-btn';
      adminBtn.dataset.nav = ADMIN_GATEWAY;
      adminBtn.style.cssText = 'border-color: rgba(224,90,71,0.5); color: #E05A47; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;';
      adminBtn.innerHTML = `${icon('shield')} Admin`;
      actionsEl.prepend(adminBtn);
    } else if (!isAdmin && adminBtn) {
      adminBtn.remove();
    }
  }
}
