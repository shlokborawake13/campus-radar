/* ============================================
   CAMPUS RADAR — MOBILE BOTTOM NAVIGATION
   ============================================ */
import { icon } from '../utils/icons.js';
import { navigate, isActive } from '../router.js';

const bottomLinks = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/trending', label: 'Trending', icon: 'trending' },
  { path: '/confessions', label: 'Confess', icon: 'confession' },
  { path: '/events', label: 'Events', icon: 'calendar' },
  { path: '/discover', label: 'Discover', icon: 'compass' },
];

export function renderBottomNav() {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.id = 'bottom-nav';
  nav.setAttribute('aria-label', 'Mobile navigation');

  nav.innerHTML = bottomLinks.map(link => `
    <button class="bottom-nav__item ${isActive(link.path) ? 'bottom-nav__item--active' : ''}"
            data-nav="${link.path}" aria-label="${link.label}">
      ${icon(link.icon)}
      <span>${link.label}</span>
    </button>
  `).join('');

  nav.addEventListener('click', (e) => {
    const item = e.target.closest('[data-nav]');
    if (item) {
      navigate(item.dataset.nav);
    }
  });

  return nav;
}

export function updateBottomNav() {
  const items = document.querySelectorAll('.bottom-nav__item');
  items.forEach(item => {
    const path = item.dataset.nav;
    item.classList.toggle('bottom-nav__item--active', isActive(path));
  });
}
