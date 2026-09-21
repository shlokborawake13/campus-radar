/* ============================================
   CAMPUS RADAR — ADMIN ANALYTICS
   Connected to live PostgreSQL database & backend
   ============================================ */
import { icon } from '../../utils/icons.js';
import { api } from '../../services/api.js';

export function renderAdminAnalytics(mainEl) {
  mainEl.innerHTML = `
    <div class="anim-fade-in-up">
      <p class="eyebrow">Analytics</p>
      <h1 class="heading-section">Platform Insights</h1>
    </div>

    <div id="analytics-error-container"></div>

    <div class="stats-grid anim-fade-in-up" style="animation-delay: 80ms;" id="analytics-stats-grid">
      <div class="stat-card">
        <div class="stat-card__label">Daily Active Users</div>
        <div class="stat-card__value" id="an-dau">—</div>
        <div class="stat-card__change" id="an-dau-chg">Loading...</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Posts Today</div>
        <div class="stat-card__value" id="an-posts-today">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Confessions Today</div>
        <div class="stat-card__value" id="an-conf-today">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Total Likes</div>
        <div class="stat-card__value" id="an-likes">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Total Comments</div>
        <div class="stat-card__value" id="an-comments">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">Registrations This Week</div>
        <div class="stat-card__value" id="an-reg-week">—</div>
        <div class="stat-card__change" id="an-reg-chg">Loading...</div>
      </div>
    </div>

    <div class="admin-grid anim-fade-in-up" style="animation-delay: 160ms;">
      <div class="card">
        <h3 class="heading-small" style="margin-bottom: var(--space-6);">Daily Users (This Week)</h3>
        <div class="chart-bar chart-bar--tall" id="analytics-chart-container">
          <p class="body-small" style="color: var(--text-tertiary); text-align: center; width: 100%; padding: var(--space-8);">Loading user activity chart...</p>
        </div>
      </div>

      <div class="card">
        <h3 class="heading-small" style="margin-bottom: var(--space-6);">Content Distribution</h3>
        <div class="analytics-dist" id="analytics-dist-container">
          <p class="body-small" style="color: var(--text-tertiary); text-align: center; padding: var(--space-8);">Calculating content distribution...</p>
        </div>
      </div>
    </div>
  `;

  const errorContainer = mainEl.querySelector('#analytics-error-container');

  async function loadAnalytics() {
    errorContainer.innerHTML = '';

    try {
      const data = await api.getAdminAnalytics();

      mainEl.querySelector('#an-dau').innerText = (data.dailyActiveUsers ?? 0).toLocaleString();
      mainEl.querySelector('#an-dau-chg').innerText = data.dauChange || 'No active sessions';

      mainEl.querySelector('#an-posts-today').innerText = (data.postsToday ?? 0).toLocaleString();
      mainEl.querySelector('#an-conf-today').innerText = (data.confessionsToday ?? 0).toLocaleString();
      mainEl.querySelector('#an-likes').innerText = (data.totalLikes ?? 0).toLocaleString();
      mainEl.querySelector('#an-comments').innerText = (data.totalComments ?? 0).toLocaleString();

      mainEl.querySelector('#an-reg-week').innerText = (data.registrationsThisWeek ?? 0).toLocaleString();
      mainEl.querySelector('#an-reg-chg').innerText = data.weekChange || 'No previous-period data';

      // Daily users chart
      const chartEl = mainEl.querySelector('#analytics-chart-container');
      const chartData = data.chartData || [];
      if (chartData.length === 0) {
        chartEl.innerHTML = `<p class="body-small" style="color: var(--text-tertiary); text-align: center; width: 100%;">No chart data recorded</p>`;
      } else {
        const maxUsers = Math.max(1, ...chartData.map(d => d.users || 0));
        chartEl.innerHTML = chartData.map(day => `
          <div class="chart-bar__col">
            <div class="chart-bar__bars">
              <div class="chart-bar__bar chart-bar__bar--users" style="height: ${Math.max(4, Math.round(((day.users || 0) / maxUsers) * 100))}%" title="${day.users} active users on ${day.date}"></div>
            </div>
            <span class="chart-bar__label">${day.label}</span>
            <span class="chart-bar__value">${day.users || 0}</span>
          </div>
        `).join('');
      }

      // Content distribution
      const distEl = mainEl.querySelector('#analytics-dist-container');
      const totalItems = (data.totalPosts || 0) + (data.totalConfessions || 0) + (data.totalEvents || 0);

      const postPct = totalItems > 0 ? Math.round(((data.totalPosts || 0) / totalItems) * 100) : 0;
      const confPct = totalItems > 0 ? Math.round(((data.totalConfessions || 0) / totalItems) * 100) : 0;
      const eventPct = totalItems > 0 ? Math.round(((data.totalEvents || 0) / totalItems) * 100) : 0;

      distEl.innerHTML = `
        <div class="analytics-dist__item">
          <div class="analytics-dist__bar-wrap">
            <div class="analytics-dist__bar" style="width: ${postPct}%; background: var(--accent-primary);"></div>
          </div>
          <div class="flex-between" style="margin-top: var(--space-2);">
            <span class="body-small">Posts (${postPct}%)</span>
            <span class="body-small" style="font-weight: var(--weight-semibold);">${(data.totalPosts || 0).toLocaleString()}</span>
          </div>
        </div>

        <div class="analytics-dist__item" style="margin-top: var(--space-4);">
          <div class="analytics-dist__bar-wrap">
            <div class="analytics-dist__bar" style="width: ${confPct}%; background: var(--accent-peach);"></div>
          </div>
          <div class="flex-between" style="margin-top: var(--space-2);">
            <span class="body-small">Confessions (${confPct}%)</span>
            <span class="body-small" style="font-weight: var(--weight-semibold);">${(data.totalConfessions || 0).toLocaleString()}</span>
          </div>
        </div>

        <div class="analytics-dist__item" style="margin-top: var(--space-4);">
          <div class="analytics-dist__bar-wrap">
            <div class="analytics-dist__bar" style="width: ${eventPct}%; background: var(--accent-lavender);"></div>
          </div>
          <div class="flex-between" style="margin-top: var(--space-2);">
            <span class="body-small">Events (${eventPct}%)</span>
            <span class="body-small" style="font-weight: var(--weight-semibold);">${(data.totalEvents || 0).toLocaleString()}</span>
          </div>
        </div>
      `;

    } catch (err) {
      errorContainer.innerHTML = `
        <div class="card" style="border-left: 4px solid var(--color-error); padding: var(--space-4); margin-bottom: var(--space-4); background: rgba(224, 90, 71, 0.08);">
          <div class="flex-between">
            <p style="color: var(--color-error); font-size: 14px;">Failed to load analytics: ${err.message || 'Database error'}</p>
            <button class="btn btn--secondary btn--sm" id="retry-analytics-btn">Retry</button>
          </div>
        </div>
      `;
      mainEl.querySelector('#retry-analytics-btn')?.addEventListener('click', loadAnalytics);
    }
  }

  loadAnalytics();
}

