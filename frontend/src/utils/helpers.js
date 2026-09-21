/* ============================================
   CAMPUS RADAR — UTILITY HELPERS
   ============================================ */

/** Get time-based greeting */
export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Relative time string */
export function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

/** Format number with K/M suffixes */
export function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/** Format date for events */
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Format time */
export function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** Create an element with optional class and innerHTML */
export function el(tag, className = '', innerHTML = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (innerHTML) element.innerHTML = innerHTML;
  return element;
}

/** Safe query selector */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/** Safe query selector all */
export function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

/** Show a toast message */
export function showToast(message, duration = 3000) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = el('div', 'toast', message);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    toast.style.transition = 'all 300ms ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/** Get avatar color class by anonymous ID */
export function getAvatarColor(id) {
  const colors = ['', '--peach', '--lavender', '--blue', '--yellow'];
  return colors[id % colors.length];
}

/** Get avatar initials from anonymous ID */
export function getAvatarInitial(id) {
  return `#${String(id).padStart(2, '0')}`;
}

/** Get a confession card accent class */
export function getConfessionAccent(index) {
  const accents = ['card--accent-peach', 'card--accent-lavender', 'card--accent-blue', 'card--accent-yellow'];
  return accents[index % accents.length];
}

/** Simple localStorage wrapper */
export const store = {
  get(key, fallback = null) {
    try {
      const val = localStorage.getItem(`cr_${key}`);
      return val ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try {
      localStorage.setItem(`cr_${key}`, JSON.stringify(value));
    } catch { /* ignore */ }
  }
};
