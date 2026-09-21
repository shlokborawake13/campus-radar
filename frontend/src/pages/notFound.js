/* ============================================
   CAMPUS RADAR — 404 NOT FOUND PAGE
   Conceals administrative entry points and invalid URLs
   ============================================ */

export function renderNotFound(mainEl) {
  mainEl.innerHTML = `
    <div class="anim-fade-in-up" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 55vh; text-align: center; padding: var(--space-8) var(--space-4);">
      <div style="font-size: 5rem; font-weight: 800; color: var(--text-muted); line-height: 1; margin-bottom: var(--space-4);">404</div>
      <h1 class="heading-section" style="margin-bottom: var(--space-2);">Page Not Found</h1>
      <p style="color: var(--text-secondary); max-width: 420px; margin-bottom: var(--space-6);">
        The page you are looking for doesn't exist, has been removed, or is not accessible.
      </p>
      <a href="#/" class="btn btn-primary">
        Back to Campus Feed
      </a>
    </div>
  `;
}
