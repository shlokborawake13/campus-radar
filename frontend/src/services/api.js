/* ============================================
   CAMPUS RADAR — BACKEND API CLIENT
   Manages tokens, refresh rotation, error handling
   ============================================ */

const PROD_API_URL = 'https://campus-radar-dzc6.onrender.com/api';
const DEFAULT_API_URL = typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'))
  ? PROD_API_URL
  : '/api';

const RAW_API_URL = (import.meta.env?.VITE_API_URL || DEFAULT_API_URL).trim().replace(/\/+$/, '');
const API_BASE = RAW_API_URL.endsWith('/api') ? RAW_API_URL : `${RAW_API_URL}/api`;

export const tokenStorage = {
  getAccessToken: () => {
    try {
      const token = localStorage.getItem('cr_access_token');
      if (!token || token === 'undefined' || token === 'null' || !token.trim()) {
        return null;
      }
      return token.trim();
    } catch {
      return null;
    }
  },
  getRefreshToken: () => {
    try {
      const token = localStorage.getItem('cr_refresh_token');
      if (!token || token === 'undefined' || token === 'null' || !token.trim()) {
        return null;
      }
      return token.trim();
    } catch {
      return null;
    }
  },
  setTokens: (accessToken, refreshToken) => {
    try {
      if (accessToken && typeof accessToken === 'string' && accessToken !== 'undefined' && accessToken !== 'null') {
        localStorage.setItem('cr_access_token', accessToken.trim());
      }
      if (refreshToken && typeof refreshToken === 'string' && refreshToken !== 'undefined' && refreshToken !== 'null') {
        localStorage.setItem('cr_refresh_token', refreshToken.trim());
      }
    } catch (err) {
      console.error('Failed to store auth tokens:', err);
    }
  },
  clearTokens: () => {
    try {
      localStorage.removeItem('cr_access_token');
      localStorage.removeItem('cr_refresh_token');
      localStorage.removeItem('cr_user');
    } catch (err) {
      console.error('Failed to clear auth tokens:', err);
    }
  },
  getUser: () => {
    try {
      const raw = localStorage.getItem('cr_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      // Corrupted user data — clear it
      try { localStorage.removeItem('cr_user'); } catch {}
      return null;
    }
  },
  setUser: (user) => {
    try {
      if (user) {
        localStorage.setItem('cr_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('cr_user');
      }
    } catch (err) {
      console.error('Failed to persist user profile:', err);
    }
  }
};

// Global single-flight refresh lock to prevent concurrent 401 refresh storms
let refreshPromise = null;

async function executeTokenRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      tokenStorage.clearTokens();
      return null;
    }

    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data?.tokens?.accessToken) {
          tokenStorage.setTokens(data.tokens.accessToken, data.tokens.refreshToken || refreshToken);
          return data.tokens.accessToken;
        }
      }
      // If refresh rejected (expired/revoked), clear frontend tokens
      tokenStorage.clearTokens();
      return null;
    } catch {
      tokenStorage.clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function normalizeEndpoint(endpoint) {
  let ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // Prevent duplicate /api/api/
  if (ep.startsWith('/api/')) {
    ep = ep.replace(/^\/api/, '');
  }
  return ep;
}

async function request(endpoint, options = {}) {
  const cleanEndpoint = normalizeEndpoint(endpoint);
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${cleanEndpoint}`;
  const headers = {
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Only attach Authorization header when a valid non-empty access token exists
  const accessToken = tokenStorage.getAccessToken();
  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    const netErr = new Error('Unable to connect to Campus Radar. Please try again.');
    netErr.status = 0;
    throw netErr;
  }

  // Handle 401: try token refresh exactly once via the single refresh lock
  if (response.status === 401 && tokenStorage.getRefreshToken() && !options._retry && !cleanEndpoint.startsWith('/auth/login') && !cleanEndpoint.startsWith('/auth/register') && !cleanEndpoint.startsWith('/auth/refresh')) {
    options._retry = true;
    const newAccessToken = await executeTokenRefresh();
    if (newAccessToken) {
      headers.Authorization = `Bearer ${newAccessToken}`;
      try {
        response = await fetch(url, { ...options, headers });
      } catch {
        const netErr = new Error('Unable to connect to Campus Radar. Please try again.');
        netErr.status = 0;
        throw netErr;
      }
    }
  }

  // Handle 403 (banned/suspended) or permanent 401: clear tokens
  if (response.status === 403 && !cleanEndpoint.startsWith('/auth/login')) {
    tokenStorage.clearTokens();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    let message = data.error || data.message || 'Network request failed';
    if (response.status === 401 && (message.includes('Invalid') || message.includes('password') || message.includes('credentials'))) {
      message = 'Invalid email or password.';
    }
    const error = new Error(message);
    error.status = response.status;
    error.code = data.code;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  verifyOtp: (body) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify(body) }),
  resendOtp: (body) => request('/auth/resend-otp', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    tokenStorage.clearTokens();
    if (refreshToken) {
      try {
        await request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
      } catch {}
    }
  },
  getMe: () => request('/auth/me'),

  // Uploads (Strictly requires verified account)
  uploadImage: (file, onProgress) => {
    const formData = new FormData();
    formData.append('image', file);

    if (onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/uploads/images`);
        const token = tokenStorage.getAccessToken();
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.error || 'Failed to upload image'));
            }
          } catch {
            reject(new Error('Invalid response from upload server'));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during image upload'));
        xhr.send(formData);
      });
    }

    return request('/uploads/images', {
      method: 'POST',
      body: formData
    });
  },

  // Posts
  getPosts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/posts${q ? '?' + q : ''}`);
  },
  getTrending: () => request('/posts/trending'),
  getPost: (id) => request(`/posts/${id}`),
  createPost: (body) => request('/posts', { method: 'POST', body: JSON.stringify(body) }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE' }),

  // Confessions
  getConfessions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/confessions${q ? '?' + q : ''}`);
  },
  createConfession: (body) => request('/confessions', { method: 'POST', body: JSON.stringify(body) }),

  // Comments
  getComments: (targetType, targetId) => {
    const param = targetType === 'post' ? `postId=${targetId}` : `confessionId=${targetId}`;
    return request(`/comments?${param}`);
  },
  addComment: (body) => request('/comments', { method: 'POST', body: JSON.stringify(body) }),
  deleteComment: (id) => request(`/comments/${id}`, { method: 'DELETE' }),

  // Likes & Saves
  togglePostLike: (id) => request(`/posts/${id}/like`, { method: 'POST' }),
  toggleConfessionLike: (id) => request(`/confessions/${id}/like`, { method: 'POST' }),
  toggleSavePost: (id) => request(`/posts/${id}/save`, { method: 'POST' }),
  getSavedPosts: () => request('/saved'),

  // Events
  getEvents: (category) => request(`/events${category && category !== 'all' ? `?category=${category}` : ''}`),
  createEvent: (body) => request('/events', { method: 'POST', body: JSON.stringify(body) }),
  registerEvent: (id) => request(`/events/${id}/register`, { method: 'POST' }),

  // Reports
  submitReport: (body) => request('/reports', { method: 'POST', body: JSON.stringify(body) }),

  // Profile
  getProfile: (id = 'me') => request(`/profile/${id}`),
  updateProfile: (body) => request('/profile/me', { method: 'PATCH', body: JSON.stringify(body) }),

  // Admin Endpoints
  adminLogin: (body) => request('/admin/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  adminConfirmMfa: (body) => request('/admin/auth/confirm-mfa', { method: 'POST', body: JSON.stringify(body) }),
  getAdminStats: () => request('/admin/stats'),
  getAdminOverview: () => request('/admin/overview'),
  getAdminActivity: (limit = 10) => request(`/admin/activity?limit=${limit}`),
  getAdminUsers: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/users${q ? '?' + q : ''}`);
  },
  updateUserStatus: (id, status, reason = 'Administrative update') => 
    request(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }),
  updateUserRole: (id, role, reason = 'Administrative elevation') => 
    request(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role, reason }) }),
  getAdminPosts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/posts${q ? '?' + q : ''}`);
  },
  deleteAdminPost: (id) => request(`/admin/posts/${id}`, { method: 'DELETE' }),
  getAdminConfessions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/confessions${q ? '?' + q : ''}`);
  },
  deleteAdminConfession: (id) => request(`/admin/confessions/${id}`, { method: 'DELETE' }),
  getAdminEvents: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/events${q ? '?' + q : ''}`);
  },
  createAdminEvent: (body) => request('/admin/events', { method: 'POST', body: JSON.stringify(body) }),
  deleteAdminEvent: (id) => request(`/admin/events/${id}`, { method: 'DELETE' }),
  getAdminAnalytics: () => request('/admin/analytics'),
  getModerationQueue: (status = 'auto_flagged') => request(`/admin/moderation?status=${status}`),
  reviewModeration: (id, status, reviewNotes) => 
    request(`/admin/moderation/${id}/review`, { method: 'POST', body: JSON.stringify({ status, reviewNotes }) }),
  getAdminReports: (status = 'pending') => request(`/admin/reports?status=${status}`),
  resolveReport: (id, body) => request(`/admin/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify(body) }),
  getAdminAuditLogs: () => request('/admin/audit-logs')
};

