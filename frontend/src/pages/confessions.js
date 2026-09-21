/* ============================================
   CAMPUS RADAR — CONFESSIONS PAGE
   Anonymous thoughts from verified students
   ============================================ */
import { icon } from '../utils/icons.js';
import { renderConfessionCard } from '../components/confessionCard.js';
import { api, tokenStorage } from '../services/api.js';
import { showToast } from '../utils/helpers.js';
import { navigate } from '../router.js';

export function renderConfessions(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-wrapper';

  wrapper.innerHTML = `
    <div class="page-content page-content--feed">
      <div class="section-header anim-fade-in-up">
        <p class="eyebrow">Anonymous Confessions</p>
        <h1 class="heading-hero">Say what you<br>can't say out loud.</h1>
        <p class="body-text">Pseudonymous thoughts from verified Sanjivani students. Your identity remains private.</p>
      </div>

      <div class="confessions-cta anim-fade-in-up" style="text-align: center; margin-bottom: var(--space-6);">
        <button class="btn btn--primary btn--lg" id="toggle-confession-form">
          ${icon('plus')} Post Anonymous Confession
        </button>
      </div>

      <!-- Live Confession Creation Form (Collapsible) -->
      <div class="card anim-fade-in-up" id="confession-form-card" style="display: none; margin-bottom: var(--space-8); border: 1px solid var(--accent-primary);">
        <h3 class="heading-small" style="margin-bottom: var(--space-2);">Write your confession</h3>
        <p class="body-small" style="color: var(--text-secondary); margin-bottom: var(--space-4);">
          You'll be assigned a random pseudonym like <em>Silent Falcon #312</em>. No one on campus can see your real name.
        </p>
        <form id="submit-confession-form">
          <div class="input-group" style="margin-bottom: var(--space-4);">
            <label class="input-label">Category</label>
            <select class="input" id="conf-category" style="width: 100%;">
              <option value="campus-life">Campus Life</option>
              <option value="academics">Academics &amp; Exams</option>
              <option value="hostel">Hostel &amp; Mess</option>
              <option value="crushes">Crushes &amp; Dating</option>
              <option value="professors">Faculty &amp; Lectures</option>
            </select>
          </div>
          <div class="input-group" style="margin-bottom: var(--space-4);">
            <label class="input-label">Your Confession</label>
            <textarea class="input" id="conf-content" rows="4" placeholder="Type your honest confession here..." required minlength="5" maxlength="2000" style="resize: vertical;"></textarea>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: var(--space-3);">
            <button type="button" class="btn btn--secondary" id="cancel-conf-btn">Cancel</button>
            <button type="submit" class="btn btn--primary" id="post-conf-btn">Post Anonymously</button>
          </div>
        </form>
      </div>

      <!-- Categories Filter -->
      <div class="chips-row anim-fade-in-up" style="margin-bottom: var(--space-6); display: flex; gap: var(--space-2); overflow-x: auto; padding-bottom: var(--space-2);" id="confession-chips">
        <button class="chip chip--active" data-cat="all">All</button>
        <button class="chip" data-cat="campus-life">Campus Life</button>
        <button class="chip" data-cat="academics">Academics</button>
        <button class="chip" data-cat="hostel">Hostel</button>
        <button class="chip" data-cat="crushes">Crushes</button>
      </div>

      <div class="feed stagger-children" id="confessions-feed">
        <div class="loading-spinner-wrapper" style="text-align: center; padding: var(--space-8); color: var(--text-tertiary);">
          <p>Loading anonymous confessions...</p>
        </div>
      </div>
    </div>
  `;

  const feedEl = wrapper.querySelector('#confessions-feed');
  const formCard = wrapper.querySelector('#confession-form-card');
  const toggleBtn = wrapper.querySelector('#toggle-confession-form');
  let currentCategory = 'all';

  async function loadConfessions() {
    try {
      const res = await api.getConfessions(currentCategory !== 'all' ? { category: currentCategory } : {});
      const items = res.data || res.confessions || [];

      feedEl.innerHTML = '';
      if (items.length === 0) {
        feedEl.innerHTML = `
          <div class="card" style="text-align: center; padding: var(--space-12) var(--space-6); color: var(--text-secondary);">
            <div style="font-size: 2.5rem; margin-bottom: var(--space-3);">${icon('confession')}</div>
            <h3 class="heading-small" style="margin-bottom: var(--space-2);">No confessions here yet</h3>
            <p style="max-width: 360px; margin: 0 auto var(--space-6);">Have a campus secret or funny story? Be the first to share one anonymously.</p>
            <button class="btn btn--primary" id="first-conf-btn">Drop First Confession</button>
          </div>
        `;
        feedEl.querySelector('#first-conf-btn')?.addEventListener('click', () => {
          formCard.style.display = 'block';
          wrapper.querySelector('#conf-content')?.focus();
        });
        return;
      }

      items.forEach((confession, index) => {
        feedEl.appendChild(renderConfessionCard(confession, index));
      });
    } catch (err) {
      feedEl.innerHTML = `
        <div class="card" style="text-align: center; padding: var(--space-8); color: var(--text-secondary);">
          <p style="color: var(--text-primary); margin-bottom: var(--space-2);">Could not fetch confessions.</p>
          <p class="body-small" style="margin-bottom: var(--space-4);">${err.message || 'Make sure you are logged in.'}</p>
          <button class="btn btn--secondary btn--sm" id="retry-conf-btn">Retry</button>
        </div>
      `;
      feedEl.querySelector('#retry-conf-btn')?.addEventListener('click', () => loadConfessions());
    }
  }

  loadConfessions();

  // Toggle confession form
  toggleBtn.addEventListener('click', () => {
    const user = tokenStorage.getUser();
    if (!user) {
      showToast('Please sign in to post confessions');
      navigate('/login');
      return;
    }
    const isVisible = formCard.style.display !== 'none';
    formCard.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      wrapper.querySelector('#conf-content')?.focus();
    }
  });

  wrapper.querySelector('#cancel-conf-btn')?.addEventListener('click', () => {
    formCard.style.display = 'none';
  });

  // Submit confession form
  wrapper.querySelector('#submit-confession-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = wrapper.querySelector('#conf-content').value.trim();
    const category = wrapper.querySelector('#conf-category').value;
    const postBtn = wrapper.querySelector('#post-conf-btn');

    if (!content) return;

    try {
      postBtn.disabled = true;
      postBtn.innerText = 'Posting...';

      const res = await api.createConfession({ content, category });
      showToast(res.message || 'Confession posted anonymously!');
      wrapper.querySelector('#conf-content').value = '';
      formCard.style.display = 'none';
      await loadConfessions();
    } catch (err) {
      showToast(err.message || 'Failed to post confession');
    } finally {
      postBtn.disabled = false;
      postBtn.innerText = 'Post Anonymously';
    }
  });

  // Category chips
  wrapper.querySelector('#confession-chips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (!chip) return;

    wrapper.querySelectorAll('#confession-chips .chip').forEach(c => c.classList.remove('chip--active'));
    chip.classList.add('chip--active');
    currentCategory = chip.dataset.cat;
    loadConfessions();
  });

  container.appendChild(wrapper);
}
