/* ============================================
   CAMPUS RADAR — ADMIN DASHBOARD
   Connected to live PostgreSQL database & backend
   ============================================ */
import { icon } from '../../utils/icons.js';
import { api } from '../../services/api.js';
import { timeAgo } from '../../utils/helpers.js';

export function renderAdminDashboard(mainEl) {
  mainEl.innerHTML = `
    <div class="anim-fade-in-up">
      <p class="eyebrow">Admin Dashboard</p>
      <h1 class="heading-section">Overview</h1>
    </div>

    <div id="dashboard-error-container"></div>

    <div class="stats-grid anim-fade-in-up" style="animation-delay: 100ms;" id="stats-container">
      <div class="stat-card">
        <div class="stat-card__label">Total Students</div>
        <div class="stat-card__value" id="val-students">—</div>
        <div class="stat-card__change" id="chg-students">Loading...</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Active Today</div>
        <div class="stat-card__value" id="val-active">—</div>
        <div class="stat-card__change" id="chg-active">Loading...</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Total Posts</div>
        <div class="stat-card__value" id="val-posts">—</div>
        <div class="stat-card__change" id="chg-posts">Loading...</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Confessions</div>
        <div class="stat-card__value" id="val-confessions">—</div>
        <div class="stat-card__change" id="chg-confessions">Loading...</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Events</div>
        <div class="stat-card__value" id="val-events">—</div>
        <div class="stat-card__change" id="chg-events">Active campus events</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Reports</div>
        <div class="stat-card__value" id="val-reports">—</div>
        <div class="stat-card__change" id="chg-reports" style="color: var(--color-warning);">Pending review</div>
      </div>
    </div>

    <div class="admin-grid anim-fade-in-up" style="animation-delay: 200ms;">
      <div class="card">
        <h3 class="heading-small" style="margin-bottom: var(--space-4);">Recent Activity</h3>
        <div class="admin-activity-list" id="recent-activity-list">
          <p class="body-small" style="color: var(--text-tertiary); text-align: center; padding: var(--space-4);">Loading activity...</p>
        </div>
      </div>

      <div class="card">
        <h3 class="heading-small" style="margin-bottom: var(--space-4);">Reported Content</h3>
        <div class="admin-activity-list" id="reported-content-list">
          <p class="body-small" style="color: var(--text-tertiary); text-align: center; padding: var(--space-4);">Loading reports...</p>
        </div>
      </div>
    </div>

    <div class="card anim-fade-in-up" style="animation-delay: 300ms; margin-top: var(--space-6);" id="weekly-chart-card">
      <h3 class="heading-small" style="margin-bottom: var(--space-6);">Weekly Activity</h3>
      <div class="chart-bar" id="weekly-chart-bars">
        <p class="body-small" style="color: var(--text-tertiary); text-align: center; width: 100%; padding: var(--space-6);">Loading weekly chart...</p>
      </div>
      <div class="chart-legend">
        <span class="chart-legend__item"><span class="chart-legend__dot" style="background: var(--accent-primary);"></span> Posts</span>
        <span class="chart-legend__item"><span class="chart-legend__dot" style="background: var(--accent-peach);"></span> Confessions</span>
      </div>
    </div>
  `;

  async function loadDashboardData() {
    const errorContainer = mainEl.querySelector('#dashboard-error-container');
    errorContainer.innerHTML = '';

    try {
      const [overview, activityData, reportsData] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminActivity(5),
        api.getAdminReports('pending')
      ]);

      // 1. Metric Cards
      mainEl.querySelector('#val-students').innerText = (overview.totalStudents ?? 0).toLocaleString();
      mainEl.querySelector('#chg-students').innerText = overview.studentsThisWeek > 0 
        ? `+${overview.studentsThisWeek} this week` 
        : 'No new registrations this week';

      mainEl.querySelector('#val-active').innerText = (overview.activeToday ?? 0).toLocaleString();
      mainEl.querySelector('#chg-active').innerText = overview.dauChange || 'No active sessions';

      mainEl.querySelector('#val-posts').innerText = (overview.totalPosts ?? 0).toLocaleString();
      mainEl.querySelector('#chg-posts').innerText = `+${overview.postsToday ?? 0} today`;

      mainEl.querySelector('#val-confessions').innerText = (overview.totalConfessions ?? 0).toLocaleString();
      mainEl.querySelector('#chg-confessions').innerText = `+${overview.confessionsToday ?? 0} today`;

      mainEl.querySelector('#val-events').innerText = (overview.totalEvents ?? 0).toLocaleString();
      mainEl.querySelector('#chg-events').innerText = 'Active campus events';

      mainEl.querySelector('#val-reports').innerText = (overview.pendingReports ?? 0).toLocaleString();
      mainEl.querySelector('#chg-reports').innerText = overview.pendingReports > 0 
        ? `${overview.pendingReports} pending review` 
        : 'All reports resolved';

      // 2. Recent Activity List
      const activityEl = mainEl.querySelector('#recent-activity-list');
      const activities = activityData?.activity || [];
      if (activities.length === 0) {
        activityEl.innerHTML = `
          <div style="text-align: center; padding: var(--space-6); color: var(--text-tertiary);">
            <p class="body-small">No recent activity</p>
          </div>
        `;
      } else {
        activityEl.innerHTML = activities.map(item => `
          <div class="admin-activity-item">
            <div class="avatar avatar--sm" style="background: var(--bg-tertiary); color: var(--text-secondary); font-weight: 600;">
              ${item.anon_id > 0 ? '#' + String(item.anon_id).padStart(2, '0') : '#'}
            </div>
            <div style="flex:1;">
              <p class="body-small" style="color: var(--text-primary);">
                <strong>${item.author_real_name ? `${item.author_real_name} (${item.actor_name})` : item.actor_name}</strong> ${item.action_text}
              </p>
              <p class="meta-text">${item.author_email ? `${item.author_email} • ` : ''}${timeAgo(item.created_at)}</p>
            </div>
          </div>
        `).join('');
      }

      // 3. Reported Content List
      const reportsEl = mainEl.querySelector('#reported-content-list');
      const reports = reportsData?.reports || [];
      if (reports.length === 0) {
        reportsEl.innerHTML = `
          <div style="text-align: center; padding: var(--space-6); color: var(--text-tertiary);">
            <p class="body-small">No reports found</p>
          </div>
        `;
      } else {
        reportsEl.innerHTML = reports.slice(0, 5).map(report => `
          <div class="admin-activity-item">
            <span class="badge badge--error">${report.report_count || 1} report${(report.report_count || 1) > 1 ? 's' : ''}</span>
            <div style="flex:1;">
              <p class="body-small" style="color: var(--text-primary); font-weight: 500;">
                "${(report.content_preview || 'Content removed or unavailable').slice(0, 60)}..."
              </p>
              <p class="meta-text">
                Author: <strong>${report.target_author_name || 'Student'}</strong> (${report.target_author_email || 'No email'}) • ${report.reason} • ${timeAgo(report.created_at)}
              </p>
            </div>
          </div>
        `).join('');
      }

      // 4. Weekly Activity Chart
      const chartEl = mainEl.querySelector('#weekly-chart-bars');
      const chartData = overview.weeklyChart || [];
      if (chartData.length === 0) {
        chartEl.innerHTML = `<p class="body-small" style="color: var(--text-tertiary); text-align: center; width: 100%;">No weekly chart data available</p>`;
      } else {
        const maxVal = Math.max(1, ...chartData.map(d => Math.max(d.posts || 0, d.confessions || 0)));
        chartEl.innerHTML = chartData.map(day => `
          <div class="chart-bar__col">
            <div class="chart-bar__bars">
              <div class="chart-bar__bar chart-bar__bar--posts" style="height: ${Math.max(4, Math.round(((day.posts || 0) / maxVal) * 100))}%" title="${day.posts || 0} posts on ${day.date}"></div>
              <div class="chart-bar__bar chart-bar__bar--confessions" style="height: ${Math.max(4, Math.round(((day.confessions || 0) / maxVal) * 100))}%" title="${day.confessions || 0} confessions on ${day.date}"></div>
            </div>
            <span class="chart-bar__label">${day.label}</span>
          </div>
        `).join('');
      }

    } catch (err) {
      errorContainer.innerHTML = `
        <div class="card anim-fade-in-up" style="border-left: 4px solid var(--color-error); padding: var(--space-4); margin-bottom: var(--space-6); background: rgba(224, 90, 71, 0.08);">
          <div class="flex-between">
            <div>
              <p style="color: var(--color-error); font-weight: 600;">Failed to load dashboard data</p>
              <p class="body-small" style="color: var(--text-secondary);">${err.message || 'Check database connection and permissions'}</p>
            </div>
            <button class="btn btn--secondary btn--sm" id="retry-dashboard-btn" style="border-color: var(--color-error); color: var(--color-error);">Retry</button>
          </div>
        </div>
      `;
      mainEl.querySelector('#retry-dashboard-btn')?.addEventListener('click', loadDashboardData);
    }
  }

  loadDashboardData();
}
