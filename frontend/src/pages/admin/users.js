/* ============================================
   CAMPUS RADAR — ADMIN USERS
   Connected to live PostgreSQL database & backend
   ============================================ */
import { icon } from '../../utils/icons.js';
import { api } from '../../services/api.js';
import { showToast } from '../../utils/helpers.js';

export function renderAdminUsers(mainEl) {
  mainEl.innerHTML = `
    <div class="anim-fade-in-up">
      <p class="eyebrow">User Management</p>
      <h1 class="heading-section">Students & Users</h1>
    </div>

    <div class="flex-between anim-fade-in-up" style="margin-bottom: var(--space-6); flex-wrap: wrap; gap: var(--space-4);">
      <div class="search-bar" style="max-width: 320px;">
        <span class="search-icon">${icon('search')}</span>
        <input type="text" class="input" placeholder="Search students..." id="admin-user-search" />
      </div>
      <div class="pills" id="user-status-pills">
        <button class="pill pill--active" data-filter="all">All</button>
        <button class="pill" data-filter="active">Active</button>
        <button class="pill" data-filter="suspended">Suspended</button>
        <button class="pill" data-filter="pending_verification">Pending</button>
      </div>
    </div>

    <div id="users-error-container"></div>

    <div class="table-wrapper anim-fade-in-up" style="animation-delay: 100ms;">
      <table class="table" id="users-table">
        <thead>
          <tr>
            <th>Pseudonym</th>
            <th>Real Name</th>
            <th>College Email</th>
            <th>Phone</th>
            <th>Department</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="users-tbody">
          <tr>
            <td colspan="9" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
              Loading students from database...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const tbody = mainEl.querySelector('#users-tbody');
  const pills = mainEl.querySelectorAll('.pill');
  const errorContainer = mainEl.querySelector('#users-error-container');
  let currentFilter = 'all';
  let searchQuery = '';
  let searchTimeout = null;

  async function fetchUsers() {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
          Loading students...
        </td>
      </tr>
    `;
    errorContainer.innerHTML = '';

    try {
      const params = {};
      if (currentFilter !== 'all') params.status = currentFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.getAdminUsers(params);
      const users = res.users || [];

      if (users.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
              No students found
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = users.map(user => `
        <tr>
          <td>
            <span class="badge badge--info">${user.anonymous_pseudonym || ('#' + String(user.anonymous_number || '00').padStart(2, '0'))}</span>
          </td>
          <td style="color: var(--text-primary); font-weight: var(--weight-medium);">${user.full_name}</td>
          <td>${user.email}</td>
          <td class="meta-text">${user.phone_number || '—'}</td>
          <td class="meta-text">${user.department || 'General'}</td>
          <td><span class="badge" style="background: var(--bg-tertiary);">${user.role}</span></td>
          <td>
            <span class="badge ${user.status === 'active' ? 'badge--success' : user.status === 'suspended' ? 'badge--error' : 'badge--warning'}">
              ${user.status}
            </span>
          </td>
          <td class="meta-text">${new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
          <td>
            <div style="display:flex; gap: var(--space-2);">
              ${user.status === 'suspended' ? `
                <button class="btn btn--secondary btn--sm" data-action="activate" data-id="${user.id}" title="Restore Student" style="color: var(--color-success); border-color: var(--color-success);">
                  ${icon('checkCircle')} Restore
                </button>
              ` : `
                <button class="btn btn--ghost btn--sm" data-action="suspend" data-id="${user.id}" title="Suspend Student" style="color: var(--color-error);">
                  ${icon('ban')} Suspend
                </button>
              `}
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      errorContainer.innerHTML = `
        <div class="card" style="border-left: 4px solid var(--color-error); padding: var(--space-4); margin-bottom: var(--space-4); background: rgba(224, 90, 71, 0.08);">
          <div class="flex-between">
            <p style="color: var(--color-error); font-size: 14px;">Failed to load users: ${err.message || 'Database error'}</p>
            <button class="btn btn--secondary btn--sm" id="retry-users-btn">Retry</button>
          </div>
        </div>
      `;
      mainEl.querySelector('#retry-users-btn')?.addEventListener('click', fetchUsers);
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: var(--space-6); color: var(--color-error);">
            Error loading records
          </td>
        </tr>
      `;
    }
  }

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('pill--active'));
      pill.classList.add('pill--active');
      currentFilter = pill.dataset.filter;
      fetchUsers();
    });
  });

  mainEl.querySelector('#admin-user-search').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      fetchUsers();
    }, 300);
  });

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const userId = btn.dataset.id;

    if (action === 'suspend') {
      if (!confirm('Are you sure you want to suspend this student account?')) return;
      try {
        btn.disabled = true;
        await api.updateUserStatus(userId, 'suspended', 'Administrative moderation action');
        showToast('Student account suspended');
        fetchUsers();
      } catch (err) {
        showToast(err.message || 'Could not suspend user');
        btn.disabled = false;
      }
    } else if (action === 'activate') {
      try {
        btn.disabled = true;
        await api.updateUserStatus(userId, 'active', 'Administrative restoration');
        showToast('Student account restored to active');
        fetchUsers();
      } catch (err) {
        showToast(err.message || 'Could not restore user');
        btn.disabled = false;
      }
    }
  });

  fetchUsers();
}

