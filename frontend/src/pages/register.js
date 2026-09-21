/* ============================================
   CAMPUS RADAR — REGISTER PAGE
   ============================================ */
import { navigate } from '../router.js';
import { showToast } from '../utils/helpers.js';
import { api } from '../services/api.js';

export function renderRegister(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'auth-wrapper';

  wrapper.innerHTML = `
    <div class="auth-container anim-fade-in-up">
      <div class="auth-header">
        <a class="navbar__logo" style="font-size: var(--text-2xl); margin-bottom: var(--space-8); display: block; text-align: center; cursor: pointer;" data-nav="/">
          Campus <span>Radar</span>
        </a>
        <h1 class="heading-section" style="text-align: center;">Join your campus.</h1>
        <p class="body-text" style="text-align: center;">Registration is exclusively for Sanjivani University students.</p>
      </div>

      <form class="auth-form" id="register-form">
        <div class="input-group">
          <label class="input-label">Full Name *</label>
          <input type="text" class="input input--lg" placeholder="e.g. Rohan Sharma" required id="reg-name" />
        </div>

        <div class="input-group">
          <label class="input-label">Sanjivani College Email *</label>
          <input type="email" class="input input--lg" placeholder="you@sanjivani.edu.in" required id="reg-email" />
          <span class="body-small" style="color: var(--text-tertiary);">Must be an official @sanjivani.edu.in address</span>
        </div>

        <div class="input-group">
          <label class="input-label">Phone Number * <span style="color: var(--accent-primary); font-size: 11px;">(Mandatory)</span></label>
          <input type="tel" class="input input--lg" placeholder="+91 9876543210" required id="reg-phone" minlength="10" maxlength="15" />
          <span class="body-small" style="color: var(--text-tertiary);">Required for student verification</span>
        </div>

        <div class="input-group">
          <label class="input-label">Department / Branch (Optional)</label>
          <input type="text" class="input input--lg" placeholder="e.g. Computer Science, Mechanical" id="reg-dept" />
        </div>

        <div class="input-group">
          <label class="input-label">Password *</label>
          <input type="password" class="input input--lg" placeholder="At least 8 chars with uppercase, lowercase, number" required id="reg-password" minlength="8" />
        </div>

        <div class="input-group">
          <label class="input-label">Confirm Password *</label>
          <input type="password" class="input input--lg" placeholder="Confirm your password" required id="reg-confirm" />
        </div>

        <button type="submit" class="btn btn--primary btn--lg btn--full" style="margin-top: var(--space-6);" id="reg-submit-btn">
          Create Account &amp; Send OTP
        </button>
      </form>

      <div class="auth-footer">
        <p class="body-small" style="text-align: center; margin-top: var(--space-6);">
          Already have an account? <a style="color: var(--accent-primary); font-weight: var(--weight-medium); cursor: pointer;" data-nav="/login">Sign in</a>
        </p>
      </div>
    </div>
  `;

  wrapper.querySelector('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = wrapper.querySelector('#reg-name').value.trim();
    const email = wrapper.querySelector('#reg-email').value.trim().toLowerCase();
    const phone = wrapper.querySelector('#reg-phone').value.trim();
    const dept = wrapper.querySelector('#reg-dept').value.trim();
    const password = wrapper.querySelector('#reg-password').value;
    const confirm = wrapper.querySelector('#reg-confirm').value;
    const submitBtn = wrapper.querySelector('#reg-submit-btn');

    if (!email.endsWith('@sanjivani.edu.in')) {
      showToast('Registration requires an @sanjivani.edu.in email');
      return;
    }

    if (!phone || phone.length < 10) {
      showToast('Please enter a valid phone number (minimum 10 digits)');
      return;
    }

    if (password !== confirm) {
      showToast('Passwords do not match');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Creating account...';

      const res = await api.register({
        fullName: name,
        email,
        phoneNumber: phone,
        department: dept || undefined,
        password
      });

      sessionStorage.setItem('pending_verification_email', email);
      showToast(res.message || 'OTP sent to your email!');
      navigate('/verify-email');
    } catch (err) {
      showToast(err.message || 'Registration failed');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Create Account & Send OTP';
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
