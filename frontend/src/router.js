/* ============================================
   CAMPUS RADAR — CLIENT-SIDE ROUTER
   Hash-based SPA routing
   ============================================ */

const routes = {};
let currentRoute = null;

export function route(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return currentRoute;
}

export function startRouter() {
  const handleRoute = () => {
    const hash = window.location.hash.slice(1) || '/';
    currentRoute = hash;

    // Find matching route
    let handler = routes[hash];

    // Check for parameterized routes
    if (!handler) {
      for (const [pattern, h] of Object.entries(routes)) {
        if (pattern.includes(':')) {
          const regex = new RegExp('^' + pattern.replace(/:[\w]+/g, '([\\w-]+)') + '$');
          const match = hash.match(regex);
          if (match) {
            handler = () => h(match[1]);
            break;
          }
        }
      }
    }

    if (handler) {
      handler();
    } else if (routes['*']) {
      routes['*']();
    } else if (routes['/404']) {
      routes['/404']();
    } else {
      // fallback
      navigate('/');
    }
  };

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

/** Helper to check if current route matches */
export function isActive(path) {
  const current = window.location.hash.slice(1) || '/';
  if (path === '/') return current === '/';
  return current.startsWith(path);
}
