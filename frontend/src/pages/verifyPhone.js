/* ============================================
   CAMPUS RADAR — VERIFY PHONE PAGE
   ============================================ */
import { icon } from '../utils/icons.js';
import { navigate } from '../router.js';
import { showToast } from '../utils/helpers.js';

export function renderVerifyPhone(container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'auth-wrapper';

  wrapper.innerHTML = `
    <div class="auth-container auth-container--verify anim-fade-in-up">
      <div class="verify-icon">
        ${icon('phone')}
      </div>

      <h1 class="heading-section" style="text-align: center;">Verify your phone</h1>
      <p class="body-text" style="text-align: center; margin-bottom: var(--space-8);">
        We've sent a verification code to:<br>
        <strong style="color: var(--text-primary);">+91 98XXX XXXXX</strong>
      </p>

      <div class="otp-group" id="otp-group-phone">
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" aria-label="Digit 1" />
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" aria-label="Digit 2" />
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" aria-label="Digit 3" />
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" aria-label="Digit 4" />
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" aria-label="Digit 5" />
        <input type="text" class="otp-input" maxlength="1" inputmode="numeric" pattern="[0-9]" aria-label="Digit 6" />
      </div>

      <button class="btn btn--primary btn--lg btn--full" id="verify-phone-btn" style="margin-top: var(--space-8);">
        Verify Phone
      </button>

      <p class="body-small" style="text-align: center; margin-top: var(--space-6);">
        Didn't receive the code? <a style="color: var(--accent-primary); font-weight: var(--weight-medium); cursor: pointer;" id="resend-phone">Resend code</a>
      </p>

      <div class="verify-steps">
        <div class="verify-step verify-step--done">
          <div class="verify-step__dot">${icon('check')}</div>
          <span>Email</span>
        </div>
        <div class="verify-step__line verify-step__line--done"></div>
        <div class="verify-step verify-step--active">
          <div class="verify-step__dot"></div>
          <span>Phone</span>
        </div>
        <div class="verify-step__line"></div>
        <div class="verify-step">
          <div class="verify-step__dot"></div>
          <span>Done</span>
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

  wrapper.querySelector('#verify-phone-btn').addEventListener('click', () => {
    const code = [...otpInputs].map(i => i.value).join('');
    if (code.length < 6) {
      showToast('Please enter the full 6-digit code');
      return;
    }
    showToast('Phone verified! Account created successfully! 🎉');
    setTimeout(() => navigate('/'), 1000);
  });

  wrapper.querySelector('#resend-phone').addEventListener('click', () => {
    showToast('Verification code resent');
  });

  container.appendChild(wrapper);
}
