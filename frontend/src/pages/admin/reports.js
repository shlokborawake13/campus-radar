/* ============================================
   CAMPUS RADAR — ADMIN REPORTS & MODERATION
   Connected to live PostgreSQL database & backend
   ============================================ */
import { icon } from '../../utils/icons.js';
import { api } from '../../services/api.js';
import { timeAgo, showToast } from '../../utils/helpers.js';

export function renderAdminReports(mainEl) {
  mainEl.innerHTML = `
    <div class="anim-fade-in-up">
      <p class="eyebrow">Moderation Center</p>
      <h1 class="heading-section">Reports & Moderation</h1>
    </div>

    <div class="stats-grid anim-fade-in-up" style="animation-delay: 80ms;">
      <div class="stat-card">
        <div class="stat-card__label">Pending Reports</div>
        <div class="stat-card__value" id="val-pending-rep">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Reviewed Reports</div>
        <div class="stat-card__value" id="val-reviewed-rep">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Moderation Queue</div>
        <div class="stat-card__value" id="val-mod-queue">—</div>
      </div>
    </div>

    <div id="reports-error-container"></div>

    <div class="tabs anim-fade-in-up" style="animation-delay: 120ms;" id="report-tabs">
      <button class="tab tab--active" data-tab="pending">Pending</button>
      <button class="tab" data-tab="reviewed">Reviewed</button>
      <button class="tab" data-tab="all">All Reports</button>
    </div>

    <div class="reports-list anim-fade-in-up" style="animation-delay: 160ms;" id="reports-list">
      <div style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
        Loading reports from database...
      </div>
    </div>
  `;

  const list = mainEl.querySelector('#reports-list');
  const tabs = mainEl.querySelector('#report-tabs');
  const errorContainer = mainEl.querySelector('#reports-error-container');
  let currentTab = 'pending';

  async function loadReportsData() {
    list.innerHTML = `
      <div style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
        Loading reports...
      </div>
    `;
    errorContainer.innerHTML = '';

    try {
      const [overview, reportsRes] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminReports(currentTab)
      ]);

      mainEl.querySelector('#val-pending-rep').innerText = (overview.pendingReports ?? 0).toLocaleString();
      mainEl.querySelector('#val-reviewed-rep').innerText = (overview.reviewedReports ?? 0).toLocaleString();
      mainEl.querySelector('#val-mod-queue').innerText = (overview.pendingReports ?? 0).toLocaleString();

      const reports = reportsRes.reports || [];

      if (reports.length === 0) {
        list.innerHTML = `
          <div class="card" style="text-align: center; padding: var(--space-12) var(--space-4); color: var(--text-tertiary);">
            <div style="font-size: 2rem; margin-bottom: var(--space-2);">🛡️</div>
            <h3 class="heading-small" style="color: var(--text-primary); margin-bottom: var(--space-1);">All Clear</h3>
            <p class="body-text">No ${currentTab === 'all' ? '' : currentTab} reports found in database.</p>
          </div>
        `;
        return;
      }

      list.innerHTML = reports.map(report => `
        <div class="card" style="margin-bottom: var(--space-4);" data-card-id="${report.id}">
          <div class="flex-between" style="margin-bottom: var(--space-3); flex-wrap: wrap; gap: var(--space-2);">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="badge ${report.status === 'pending' ? 'badge--warning' : 'badge--success'}">${report.status}</span>
              <span class="badge badge--error">${report.report_count || 1} report${(report.report_count || 1) > 1 ? 's' : ''}</span>
              <span class="badge" style="background: var(--bg-tertiary);">${(report.target_type || 'post').toUpperCase()}</span>
            </div>
            <span class="meta-text">${timeAgo(report.created_at)}</span>
          </div>

          <div style="margin-bottom: var(--space-3);">
            <p class="body-small" style="color: var(--text-primary);"><strong>Reason:</strong> <span style="color: var(--color-error);">${report.reason}</span></p>
            ${report.details ? `<p class="body-small" style="color: var(--text-secondary); margin-top: var(--space-1);"><strong>Details:</strong> ${report.details}</p>` : ''}
            <div style="margin-top: var(--space-2); padding: var(--space-3); background: var(--bg-secondary); border-radius: var(--radius-sm); border-left: 3px solid var(--accent-primary);">
              <p class="body-small" style="color: var(--text-primary); font-style: italic;">
                "${report.content_preview || 'Content unavailable or target record removed'}"
              </p>
            </div>
            <p class="meta-text" style="margin-top: var(--space-2);">
              Author: <strong>${report.target_author_name || 'Student'}</strong> (${report.target_author_email || 'No email'}) • Reported by <strong>${report.reporter_name || 'Student'}</strong> (${report.reporter_email || 'No email'})
            </p>
          </div>

          ${report.status === 'pending' ? `
            <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
              <button class="btn btn--danger btn--sm" data-action="remove" data-id="${report.id}">${icon('trash')} Remove Content</button>
              <button class="btn btn--secondary btn--sm" data-action="dismiss" data-id="${report.id}">${icon('check')} Dismiss Report</button>
              <button class="btn btn--ghost btn--sm" data-action="suspend" data-id="${report.id}" style="color: var(--color-error);">${icon('ban')} Suspend User</button>
            </div>
          ` : `
            <div class="meta-text" style="color: var(--color-success); font-weight: 500;">
              ✓ Status: ${report.status} ${report.action_notes ? `— ${report.action_notes}` : ''}
            </div>
          `}
        </div>
      `).join('');

    } catch (err) {
      errorContainer.innerHTML = `
        <div class="card" style="border-left: 4px solid var(--color-error); padding: var(--space-4); margin-bottom: var(--space-4); background: rgba(224, 90, 71, 0.08);">
          <div class="flex-between">
            <p style="color: var(--color-error); font-size: 14px;">Failed to load reports: ${err.message || 'Database error'}</p>
            <button class="btn btn--secondary btn--sm" id="retry-reports-btn">Retry</button>
          </div>
        </div>
      `;
      mainEl.querySelector('#retry-reports-btn')?.addEventListener('click', loadReportsData);
      list.innerHTML = `<div style="text-align: center; padding: var(--space-6); color: var(--color-error);">Error loading reports</div>`;
    }
  }

  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('tab--active'));
    tab.classList.add('tab--active');
    currentTab = tab.dataset.tab;
    loadReportsData();
  });

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const reportId = btn.dataset.id;
    const card = list.querySelector(`[data-card-id="${reportId}"]`);

    if (action === 'remove') {
      if (!confirm('Are you sure you want to remove this content and mark report resolved?')) return;
      try {
        btn.disabled = true;
        await api.resolveReport(reportId, {
          status: 'action_taken',
          actionToTake: 'remove_content',
          actionNotes: 'Content removed by administrator'
        });
        showToast('Report resolved and content removed from platform');
        loadReportsData();
      } catch (err) {
        showToast(err.message || 'Failed to resolve report');
        btn.disabled = false;
      }
    } else if (action === 'dismiss') {
      try {
        btn.disabled = true;
        await api.resolveReport(reportId, {
          status: 'dismissed',
          actionToTake: 'none',
          actionNotes: 'Report dismissed as non-violating'
        });
        showToast('Report dismissed');
        loadReportsData();
      } catch (err) {
        showToast(err.message || 'Failed to dismiss report');
        btn.disabled = false;
      }
    } else if (action === 'suspend') {
      if (!confirm('Are you sure you want to suspend the user and mark report as action taken?')) return;
      try {
        btn.disabled = true;
        await api.resolveReport(reportId, {
          status: 'action_taken',
          actionToTake: 'suspend_user',
          actionNotes: 'User suspended for policy violation'
        });
        showToast('User suspended and report resolved');
        loadReportsData();
      } catch (err) {
        showToast(err.message || 'Failed to suspend user');
        btn.disabled = false;
      }
    }
  });

  loadReportsData();
}

