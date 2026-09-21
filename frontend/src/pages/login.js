/* ============================================
   CAMPUS RADAR — LOGIN PAGE
   ============================================ */
import { navigate } from '../router.js';
import { showToast } from '../utils/helpers.js';
import { api, tokenStorage } from '../services/api.js';

export function renderLogin(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'auth-wrapper';

  wrapper.innerHTML = `
    <div class="auth-container anim-fade-in-up">
      <div class="auth-header">
        <a class="navbar__logo" style="font-size: var(--text-2xl); margin-bottom: var(--space-8); display: block; text-align: center; cursor: pointer;" data-nav="/">
          Campus <span>Radar</span>
        </a>
        <h1 class="heading-section" style="text-align: center;">Welcome back.</h1>
        <p class="body-text" style="text-align: center;">Sign in to your campus community.</p>
      </div>

      <form class="auth-form" id="login-form">
        <div class="input-group">
          <label class="input-label">College Email</label>
          <input type="email" class="input input--lg" placeholder="you@sanjivani.edu.in" required id="login-email" />
        </div>

        <div class="input-group">
          <label class="input-label">Password</label>
          <input type="password" class="input input--lg" placeholder="Enter your password" required id="login-password" />
        </div>

        <button type="submit" class="btn btn--primary btn--lg btn--full" style="margin-top: var(--space-6);" id="login-submit-btn">
          Sign In
        </button>
      </form>

      <div class="auth-footer">
        <p class="body-small" style="text-align: center; margin-top: var(--space-6);">
          Don't have an account? <a style="color: var(--accent-primary); font-weight: var(--weight-medium); cursor: pointer;" data-nav="/register">Create one</a>
        </p>
      </div>
    </div>
  `;

  wrapper.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = wrapper.querySelector('#login-email').value.trim().toLowerCase();
    const password = wrapper.querySelector('#login-password').value;
    const submitBtn = wrapper.querySelector('#login-submit-btn');

    try {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Signing in...';

      const res = await api.login({ email, password });

      if (res.requiresVerification) {
        sessionStorage.setItem('pending_verification_email', email);
        showToast(res.message || 'Verification required. A code was sent to your email.');
        navigate('/verify-email');
        return;
      }

      if (res.tokens && res.user) {
        tokenStorage.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
        tokenStorage.setUser(res.user);
        showToast(`Welcome back, ${res.user.anonymousPseudonym || 'student'}!`);
        navigate('/');
      }
    } catch (err) {
      showToast(err.message || 'Login failed');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In';
    }
  });

  wrapper.addEventListener('click', (e) => {
    const navLink = e.target.closest('[data-nav]');
    if (navLink) {
      e.preventDefault();
      navigate(navLink.dataset.nav);
    }
  });

  container.appendChild(wrapper);
}
