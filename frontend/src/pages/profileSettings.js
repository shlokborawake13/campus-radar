/* ============================================
   CAMPUS RADAR — PROFILE SETTINGS
   ============================================ */
import { icon } from '../utils/icons.js';
import { navigate } from '../router.js';
import { showToast } from '../utils/helpers.js';
import { api, tokenStorage } from '../services/api.js';

export function renderProfileSettings(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-wrapper';

  const user = tokenStorage.getUser() || { fullName: 'Student', email: '', department: '' };

  wrapper.innerHTML = `
    <div class="page-content page-content--narrow">
      <div class="settings-header anim-fade-in-up">
        <button class="btn btn--ghost btn--sm" id="back-btn">
          ${icon('arrowLeft')} Back to Profile
        </button>
        <h1 class="heading-section" style="margin-top: var(--space-4);">Account Settings</h1>
        <p class="body-text">Manage your personal details and campus profile.</p>
      </div>

      <div class="settings-sections anim-fade-in-up" style="animation-delay: 100ms;">
        <form id="profile-settings-form" class="card" style="margin-bottom: var(--space-4);">
          <h3 class="heading-small" style="margin-bottom: var(--space-5);">Student Information</h3>

          <div class="input-group" style="margin-bottom: var(--space-4);">
            <label class="input-label">Full Name</label>
            <input type="text" class="input" id="set-name" value="${user.fullName || ''}" required />
          </div>

          <div class="input-group" style="margin-bottom: var(--space-4);">
            <label class="input-label">College Email</label>
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <input type="email" class="input" value="${user.email || ''}" readonly style="flex:1; background: var(--bg-secondary); color: var(--text-tertiary);" />
              <span class="badge badge--success">${icon('checkCircle')} Verified</span>
            </div>
          </div>

          <div class="input-group" style="margin-bottom: var(--space-4);">
            <label class="input-label">Department / Branch</label>
            <input type="text" class="input" id="set-dept" value="${user.department || ''}" placeholder="e.g. Computer Engineering" />
          </div>

          <div class="input-group" style="margin-bottom: var(--space-4);">
            <label class="input-label">Bio</label>
            <textarea class="input" id="set-bio" rows="3" placeholder="Tell other Sanjivani students about your projects, interests, or hobbies..." style="resize: vertical;"></textarea>
          </div>

          <button type="submit" class="btn btn--primary" id="save-settings-btn">
            Save Changes
          </button>
        </form>

        <div class="card" style="margin-bottom: var(--space-4);">
          <h3 class="heading-small" style="margin-bottom: var(--space-4);">${icon('shield')} Verification &amp; Privacy</h3>
          <div style="font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.6;">
            <p style="margin-bottom: var(--space-2);">✓ <strong>Email Verified:</strong> Full access to campus feed and event registrations.</p>
            <p style="margin-bottom: var(--space-2);">🔒 <strong>Confession Privacy:</strong> Your name and email are never exposed on anonymous posts.</p>
          </div>
        </div>

        <button class="btn btn--ghost btn--full" id="sign-out" style="margin-top: var(--space-4); color: var(--color-error); border: 1px solid var(--border-light);">
          ${icon('logOut')} Sign Out
        </button>
      </div>
    </div>
  `;

  wrapper.querySelector('#back-btn').addEventListener('click', () => navigate('/profile'));

  // Load existing bio
  api.getProfile('me').then(res => {
    if (res?.profile?.bio) {
      const bioEl = wrapper.querySelector('#set-bio');
      if (bioEl) bioEl.value = res.profile.bio;
    }
  }).catch(() => {});

  // Save changes
  wrapper.querySelector('#profile-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = wrapper.querySelector('#set-name').value.trim();
    const department = wrapper.querySelector('#set-dept').value.trim();
    const bio = wrapper.querySelector('#set-bio').value.trim();
    const saveBtn = wrapper.querySelector('#save-settings-btn');

    try {
      saveBtn.disabled = true;
      saveBtn.innerText = 'Saving...';

      const updated = await api.updateProfile({
        fullName,
        department: department || undefined,
        bio: bio || undefined
      });

      if (updated) {
        const currentUser = tokenStorage.getUser() || {};
        tokenStorage.setUser({
          ...currentUser,
          fullName: updated.full_name || fullName,
          department: updated.department || department
        });
      }

      showToast('Profile updated successfully!');
      setTimeout(() => navigate('/profile'), 500);
    } catch (err) {
      showToast(err.message || 'Could not update profile');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerText = 'Save Changes';
    }
  });

  wrapper.querySelector('#sign-out').addEventListener('click', async () => {
    try {
      await api.logout();
    } catch {}
    tokenStorage.clearTokens();
    showToast('Signed out');
    navigate('/login');
  });

  container.appendChild(wrapper);
}
