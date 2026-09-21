/* ============================================
   CAMPUS RADAR — ADMIN CONFESSIONS
   Connected to live PostgreSQL database & backend
   Admin-only privileged visibility of real user identities
   ============================================ */
import { icon } from '../../utils/icons.js';
import { api } from '../../services/api.js';
import { timeAgo, showToast } from '../../utils/helpers.js';

export function renderAdminConfessions(mainEl) {
  mainEl.innerHTML = `
    <div class="anim-fade-in-up">
      <p class="eyebrow">Content Management</p>
      <h1 class="heading-section">Student Confessions</h1>
    </div>

    <div class="flex-between anim-fade-in-up" style="margin-bottom: var(--space-6); flex-wrap: wrap; gap: var(--space-4);">
      <div class="search-bar" style="max-width: 320px;">
        <span class="search-icon">${icon('search')}</span>
        <input type="text" class="input" placeholder="Search by content or author..." id="admin-confession-search" />
      </div>
      <div class="body-small" style="color: var(--text-tertiary);" id="confessions-count-label">Loading confessions...</div>
    </div>

    <div id="confessions-error-container"></div>

    <div class="table-wrapper anim-fade-in-up" style="animation-delay: 100ms;">
      <table class="table" id="confessions-table">
        <thead>
          <tr>
            <th>Author (Real Name)</th>
            <th>Pseudonym</th>
            <th>Content</th>
            <th>Category</th>
            <th>Engagement</th>
            <th>Reports</th>
            <th>Created</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="confessions-tbody">
          <tr>
            <td colspan="9" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
              Loading confessions from database...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const tbody = mainEl.querySelector('#confessions-tbody');
  const countLabel = mainEl.querySelector('#confessions-count-label');
  const errorContainer = mainEl.querySelector('#confessions-error-container');
  let searchQuery = '';
  let searchTimeout = null;

  async function fetchConfessions() {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
          Loading confessions...
        </td>
      </tr>
    `;
    errorContainer.innerHTML = '';

    try {
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.getAdminConfessions(params);
      const confessions = res.confessions || [];
      countLabel.innerText = `${confessions.length} active confession${confessions.length === 1 ? '' : 's'}`;

      if (confessions.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
              No confessions found in database
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = confessions.map(c => `
        <tr>
          <td>
            <div style="display: flex; flex-direction: column;">
              <strong style="color: var(--text-primary); font-size: var(--text-sm);">${c.author_real_name || 'Verified Student'}</strong>
              <span style="font-size: var(--text-xs); color: var(--text-tertiary);">${c.author_email || ''}${c.author_department ? ' • ' + c.author_department : ''}</span>
            </div>
          </td>
          <td>
            <span class="badge" style="background: rgba(239, 138, 98, 0.15); color: var(--accent-peach); font-weight: 600;">
              ${c.anonymous_pseudonym}
            </span>
          </td>
          <td style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c.content.replace(/"/g, '&quot;')}">
            ${c.content}
          </td>
          <td><span class="badge" style="background: var(--bg-tertiary);">${c.category || 'campus-life'}</span></td>
          <td class="meta-text">❤️ ${c.likes_count || 0} &nbsp;💬 ${c.comments_count || 0}</td>
          <td>
            ${c.report_count > 0 
              ? `<span class="badge badge--error">${c.report_count} report${c.report_count > 1 ? 's' : ''}</span>`
              : `<span class="meta-text" style="color: var(--text-tertiary);">0</span>`}
          </td>
          <td class="meta-text">${timeAgo(c.created_at)}</td>
          <td>
            <span class="badge badge--success">${c.status || 'active'}</span>
          </td>
          <td>
            <button class="btn--icon btn--danger-text" title="Delete Confession" data-action="delete" data-id="${c.id}">
              ${icon('trash')}
            </button>
          </td>
        </tr>
      `).join('');

      // Attach delete action listeners
      tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          if (!confirm('Are you sure you want to permanently remove this confession from Campus Radar?')) {
            return;
          }
          btn.disabled = true;
          try {
            await api.deleteAdminConfession(id);
            showToast('Confession removed successfully');
            fetchConfessions();
          } catch (err) {
            showToast(err.message || 'Failed to delete confession', 'error');
            btn.disabled = false;
          }
        });
      });

    } catch (err) {
      errorContainer.innerHTML = `
        <div class="card" style="border-left: 4px solid var(--color-error); padding: var(--space-4); margin-bottom: var(--space-4); background: rgba(224, 90, 71, 0.08);">
          <p style="color: var(--color-error); font-weight: 500;">Failed to load confessions</p>
          <p class="body-small" style="color: var(--text-secondary); margin-top: var(--space-1);">${err.message || 'Could not connect to the backend server'}</p>
          <button class="btn btn--secondary btn--sm" id="retry-confessions-btn" style="margin-top: var(--space-3);">Retry</button>
        </div>
      `;
      errorContainer.querySelector('#retry-confessions-btn')?.addEventListener('click', fetchConfessions);
    }
  }

  // Initial load
  fetchConfessions();

  // Search filter
  const searchInput = mainEl.querySelector('#admin-confession-search');
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchQuery = e.target.value;
    searchTimeout = setTimeout(() => {
      fetchConfessions();
    }, 300);
  });
}
