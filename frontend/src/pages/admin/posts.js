/* ============================================
   CAMPUS RADAR — ADMIN POSTS
   Connected to live PostgreSQL database & backend
   Admin-only privileged visibility of real user identities
   ============================================ */
import { icon } from '../../utils/icons.js';
import { api } from '../../services/api.js';
import { timeAgo, showToast } from '../../utils/helpers.js';

export function renderAdminPosts(mainEl) {
  mainEl.innerHTML = `
    <div class="anim-fade-in-up">
      <p class="eyebrow">Content Management</p>
      <h1 class="heading-section">Feed Posts</h1>
    </div>

    <div class="flex-between anim-fade-in-up" style="margin-bottom: var(--space-6); flex-wrap: wrap; gap: var(--space-4);">
      <div class="search-bar" style="max-width: 320px;">
        <span class="search-icon">${icon('search')}</span>
        <input type="text" class="input" placeholder="Search by content or author..." id="admin-post-search" />
      </div>
      <div class="body-small" style="color: var(--text-tertiary);" id="posts-count-label">Loading posts...</div>
    </div>

    <div id="posts-error-container"></div>

    <div class="table-wrapper anim-fade-in-up" style="animation-delay: 100ms;">
      <table class="table" id="posts-table">
        <thead>
          <tr>
            <th>Author (Real Name)</th>
            <th>Pseudonym</th>
            <th>Content</th>
            <th>Tag</th>
            <th>Engagement</th>
            <th>Reports</th>
            <th>Created</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="posts-tbody">
          <tr>
            <td colspan="9" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
              Loading posts from database...
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const tbody = mainEl.querySelector('#posts-tbody');
  const countLabel = mainEl.querySelector('#posts-count-label');
  const errorContainer = mainEl.querySelector('#posts-error-container');
  let searchQuery = '';
  let searchTimeout = null;

  async function fetchPosts() {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
          Loading posts...
        </td>
      </tr>
    `;
    errorContainer.innerHTML = '';

    try {
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.getAdminPosts(params);
      const posts = res.posts || [];
      countLabel.innerText = `${posts.length} active post${posts.length === 1 ? '' : 's'}`;

      if (posts.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
              No posts found in database
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = posts.map(post => `
        <tr>
          <td>
            <div style="display: flex; flex-direction: column;">
              <strong style="color: var(--text-primary); font-size: var(--text-sm);">${post.author_real_name || 'Verified Student'}</strong>
              <span style="font-size: var(--text-xs); color: var(--text-tertiary);">${post.author_email || ''}${post.author_department ? ' • ' + post.author_department : ''}</span>
            </div>
          </td>
          <td>
            <span class="badge badge--info">${post.author_name || ('#' + String(post.anon_id || '00').padStart(2, '0'))}</span>
          </td>
          <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${post.content.replace(/"/g, '&quot;')}">
            ${post.content}
          </td>
          <td><span class="badge" style="background: var(--bg-tertiary);">#${post.tag || 'general'}</span></td>
          <td class="meta-text">❤️ ${post.likes_count || 0} &nbsp;💬 ${post.comments_count || 0}</td>
          <td>
            ${post.report_count > 0 
              ? `<span class="badge badge--error">${post.report_count} report${post.report_count > 1 ? 's' : ''}</span>`
              : `<span class="meta-text" style="color: var(--text-tertiary);">0</span>`}
          </td>
          <td class="meta-text">${timeAgo(post.created_at)}</td>
          <td>
            <span class="badge badge--success">${post.status || 'active'}</span>
          </td>
          <td>
            <button class="btn--icon btn--danger-text" title="Delete Post" data-action="delete" data-id="${post.id}">
              ${icon('trash')}
            </button>
          </td>
        </tr>
      `).join('');

      // Attach delete action listeners
      tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          if (!confirm('Are you sure you want to permanently remove this post from the campus feed?')) {
            return;
          }
          btn.disabled = true;
          try {
            await api.deleteAdminPost(id);
            showToast('Post removed successfully');
            fetchPosts();
          } catch (err) {
            showToast(err.message || 'Failed to delete post', 'error');
            btn.disabled = false;
          }
        });
      });

    } catch (err) {
      errorContainer.innerHTML = `
        <div class="card" style="border-left: 4px solid var(--color-error); padding: var(--space-4); margin-bottom: var(--space-4); background: rgba(224, 90, 71, 0.08);">
          <p style="color: var(--color-error); font-weight: 500;">Failed to load posts</p>
          <p class="body-small" style="color: var(--text-secondary); margin-top: var(--space-1);">${err.message || 'Could not connect to the backend server'}</p>
          <button class="btn btn--secondary btn--sm" id="retry-posts-btn" style="margin-top: var(--space-3);">Retry</button>
        </div>
      `;
      errorContainer.querySelector('#retry-posts-btn')?.addEventListener('click', fetchPosts);
    }
  }

  // Initial load
  fetchPosts();

  // Search filter
  const searchInput = mainEl.querySelector('#admin-post-search');
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchQuery = e.target.value;
    searchTimeout = setTimeout(() => {
      fetchPosts();
    }, 300);
  });
}
