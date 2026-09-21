/* ============================================
   CAMPUS RADAR — THEME MANAGER
   Dark/light theme toggle with localStorage
   ============================================ */

const STORAGE_KEY = 'cr_theme';

/** Get the current theme */
export function getTheme() {
  // Check localStorage first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;

  // Fall back to system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/** Apply a theme to the document */
export function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem(STORAGE_KEY, theme);

  // Update any visible toggle buttons
  updateToggleButtons(theme);
}

/** Toggle between dark and light */
export function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);

  // Smooth transition on the body
  document.documentElement.style.transition = 'background-color 400ms ease, color 400ms ease';
  setTimeout(() => {
    document.documentElement.style.transition = '';
  }, 450);

  return next;
}

/** Update all toggle button icons on the page */
function updateToggleButtons(theme) {
  const buttons = document.querySelectorAll('.theme-toggle');
  buttons.forEach(btn => {
    const sunIcon = btn.querySelector('.theme-toggle__sun');
    const moonIcon = btn.querySelector('.theme-toggle__moon');
    if (sunIcon && moonIcon) {
      if (theme === 'dark') {
        sunIcon.style.opacity = '1';
        sunIcon.style.transform = 'rotate(0deg) scale(1)';
        moonIcon.style.opacity = '0';
        moonIcon.style.transform = 'rotate(90deg) scale(0.5)';
      } else {
        sunIcon.style.opacity = '0';
        sunIcon.style.transform = 'rotate(-90deg) scale(0.5)';
        moonIcon.style.opacity = '1';
        moonIcon.style.transform = 'rotate(0deg) scale(1)';
      }
    }
  });
}

/** Initialize theme on page load (call once) */
export function initTheme() {
  const theme = getTheme();
  applyTheme(theme);

  // Listen for system preference changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Only follow system if user hasn't manually set a preference
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}
