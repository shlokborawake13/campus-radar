/* ============================================
   CAMPUS RADAR — VERIFY EMAIL PAGE
   ============================================ */
import { icon } from '../utils/icons.js';
import { navigate } from '../router.js';
import { showToast } from '../utils/helpers.js';
import { api, tokenStorage } from '../services/api.js';

export function renderVerifyEmail(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'auth-wrapper';

  const pendingEmail = sessionStorage.getItem('pending_verification_email') || '';

  wrapper.innerHTML = `
    <div class="auth-container auth-container--verify anim-fade-in-up">
      <div class="verify-icon">
        ${icon('mail')}
      </div>

      <h1 class="heading-section" style="text-align: center;">Verify your college email</h1>
      <p class="body-text" style="text-align: center; margin-bottom: var(--space-6);">
        We've dispatched a 6-digit verification code to:<br>
        <strong style="color: var(--text-primary);" id="display-email">${pendingEmail || 'your university email'}</strong>
      </p>

      ${!pendingEmail ? `
        <div class="input-group" style="margin-bottom: var(--space-4);">
          <label class="input-label">University Email</label>
          <input type="email" class="input" placeholder="you@sanjivani.edu.in" id="manual-email" value="${pendingEmail}" />
        </div>
      ` : ''}

      <div class="otp-group" id="otp-group">
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" aria-label="Digit 1" />
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" aria-label="Digit 2" />
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" aria-label="Digit 3" />
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" aria-label="Digit 4" />
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" aria-label="Digit 5" />
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" aria-label="Digit 6" />
      </div>

      <button class="btn btn--primary btn--lg btn--full" id="verify-email-btn" style="margin-top: var(--space-8);">
        Verify &amp; Enter Campus Radar
      </button>

      <p class="body-small" style="text-align: center; margin-top: var(--space-6);">
        Didn't receive the email code? <a style="color: var(--accent-primary); font-weight: var(--weight-medium); cursor: pointer;" id="resend-email">Resend code</a>
      </p>
      <p class="body-small" style="text-align: center; margin-top: var(--space-2); color: var(--text-tertiary);">
        💡 Please check both your <strong>Inbox</strong> and <strong>Spam / Junk</strong> folder.
      </p>

      <div class="verify-steps" style="margin-top: var(--space-6);">
        <div class="verify-step verify-step--active">
          <div class="verify-step__dot"></div>
          <span>Email Verification</span>
        </div>
        <div class="verify-step__line"></div>
        <div class="verify-step">
          <div class="verify-step__dot"></div>
          <span>Active Member</span>
        </div>
      </div>
    </div>
  `;

  // OTP auto-focus logic
  const otpInputs = wrapper.querySelectorAll('.otp-input');
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = value;
      if (value && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const data = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
      data.split('').forEach((char, i) => {
        if (otpInputs[i]) otpInputs[i].value = char;
      });
      if (data.length > 0) otpInputs[Math.min(data.length, 5)].focus();
    });
  });

  const getTargetEmail = () => {
    const manualInput = wrapper.querySelector('#manual-email');
    if (manualInput && manualInput.value.trim()) return manualInput.value.trim().toLowerCase();
    return sessionStorage.getItem('pending_verification_email') || '';
  };

  const verifyBtn = wrapper.querySelector('#verify-email-btn');
  verifyBtn.addEventListener('click', async () => {
    const email = getTargetEmail();
    if (!email) {
      showToast('Please enter your university email');
      return;
    }

    const code = [...otpInputs].map(i => i.value).join('');
    if (code.length < 6) {
      showToast('Please enter the full 6-digit OTP code');
      return;
    }

    try {
      verifyBtn.disabled = true;
      verifyBtn.innerText = 'Verifying...';

      const res = await api.verifyOtp({ email, otp: code, purpose: 'registration' });
      if (res.tokens && res.user) {
        tokenStorage.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
        tokenStorage.setUser(res.user);
        sessionStorage.removeItem('pending_verification_email');
        showToast('Email verified successfully! Welcome to Campus Radar.');
        setTimeout(() => navigate('/'), 600);
      }
    } catch (err) {
      showToast(err.message || 'Verification failed');
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.innerText = 'Verify & Enter Campus Radar';
    }
  });

  let resendCooldown = 0;
  let resendTimer = null;

  const resendBtn = wrapper.querySelector('#resend-email');
  resendBtn.addEventListener('click', async () => {
    if (resendCooldown > 0) return;

    const email = getTargetEmail();
    if (!email) {
      showToast('Please enter your email to resend code');
      return;
    }

    try {
      resendBtn.innerText = 'Sending...';
      resendBtn.style.pointerEvents = 'none';

      const res = await api.resendOtp({ email, purpose: 'registration' });
      showToast(res.message || 'New verification code dispatched to your inbox');

      resendCooldown = 60;
      resendBtn.innerText = `Resend code in ${resendCooldown}s`;

      if (resendTimer) clearInterval(resendTimer);
      resendTimer = setInterval(() => {
        resendCooldown -= 1;
        if (resendCooldown <= 0) {
          clearInterval(resendTimer);
          resendBtn.innerText = 'Resend code';
          resendBtn.style.pointerEvents = 'auto';
        } else {
          resendBtn.innerText = `Resend code in ${resendCooldown}s`;
        }
      }, 1000);
    } catch (err) {
      showToast(err.message || 'Could not resend OTP');
      resendBtn.innerText = 'Resend code';
      resendBtn.style.pointerEvents = 'auto';
    }
  });

  container.appendChild(wrapper);
}

