/* ============================================
   CAMPUS RADAR — CONFESSION CARD COMPONENT
   ============================================ */
import { icon } from '../utils/icons.js';
import { timeAgo, formatNumber, getConfessionAccent, showToast } from '../utils/helpers.js';
import { api, tokenStorage } from '../services/api.js';
import { navigate } from '../router.js';

export function renderConfessionCard(confession, index = 0) {
  const pseudonym = confession.anonymous_pseudonym || confession.anonymousPseudonym || 'Ghost Scholar';
  const accentClass = getConfessionAccent(index);
  const createdAt = confession.created_at || confession.createdAt || new Date();
  
  let isLiked = !!(confession.is_liked ?? confession.liked);
  let likesCount = parseInt(confession.likes_count ?? confession.likes ?? 0, 10);
  let commentsCount = parseInt(confession.comments_count ?? confession.comments ?? 0, 10);

  const card = document.createElement('article');
  card.className = `card ${accentClass} confession-card`;
  card.id = `confession-${confession.id}`;

  card.innerHTML = `
    <div class="confession-card__header" style="display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: var(--space-2);">
        <span style="font-size: 1.1rem;">🎭</span>
        <span class="confession-card__author" style="font-weight: 600;">${pseudonym}</span>
      </div>
      <span class="confession-card__time">${timeAgo(createdAt)}</span>
    </div>

    <div class="confession-card__content" style="margin: var(--space-4) 0;">
      <p style="font-size: var(--text-base); line-height: 1.6; white-space: pre-line;">"${confession.content}"</p>
    </div>

    <div class="post-card__actions">
      <button class="post-card__action ${isLiked ? 'post-card__action--liked' : ''}" data-action="like">
        ${isLiked ? icon('heartFilled') : icon('heart')}
        <span class="likes-count">${formatNumber(likesCount)}</span>
      </button>
      <button class="post-card__action" data-action="comment">
        ${icon('comment')}
        <span>${formatNumber(commentsCount)}</span>
      </button>
      <button class="post-card__action" data-action="report">
        ${icon('flag')}
      </button>
    </div>
  `;

  card.addEventListener('click', async (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.dataset.action;

    const user = tokenStorage.getUser();
    if (!user) {
      showToast('Please sign in to interact with confessions');
      navigate('/login');
      return;
    }

    if (action === 'comment') {
      const existing = card.querySelector('.comments-section');
      if (existing) {
        existing.remove();
        return;
      }

      const commentSection = document.createElement('div');
      commentSection.className = 'comments-section';
      commentSection.style.cssText = 'margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--border-light);';
      commentSection.innerHTML = `
        <div class="comments-list" style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-3);">
          <div style="color: var(--text-tertiary); font-size: var(--text-xs);">Loading comments...</div>
        </div>
        <form class="add-comment-form" style="display: flex; gap: var(--space-2);">
          <input type="text" class="input input--sm" placeholder="Reply anonymously..." required style="flex: 1;" />
          <button type="submit" class="btn btn--primary btn--sm">Reply</button>
        </form>
      `;
      card.appendChild(commentSection);

      const listEl = commentSection.querySelector('.comments-list');
      const formEl = commentSection.querySelector('.add-comment-form');

      const loadComments = async () => {
        try {
          const res = await api.getComments('confession', confession.id);
          const comments = res.comments || res.data || (Array.isArray(res) ? res : []);
          if (comments.length === 0) {
            listEl.innerHTML = `<div style="color: var(--text-tertiary); font-size: var(--text-xs);">No comments yet. Share your thoughts anonymously!</div>`;
          } else {
            listEl.innerHTML = comments.map(c => `
              <div style="font-size: var(--text-sm); line-height: 1.4; padding: var(--space-2); background: var(--bg-secondary); border-radius: var(--radius-sm);">
                <span style="font-weight: 600; color: var(--text-primary); font-size: var(--text-xs);">${c.author_name || 'Anonymous Student'}</span>
                <p style="margin-top: 2px; color: var(--text-secondary);">${c.content}</p>
              </div>
            `).join('');
          }
        } catch {
          listEl.innerHTML = `<div style="color: var(--text-tertiary); font-size: var(--text-xs);">Could not load comments.</div>`;
        }
      };
      loadComments();

      formEl.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const input = formEl.querySelector('input');
        const text = input.value.trim();
        if (!text) return;
        try {
          input.disabled = true;
          await api.addComment({ confessionId: confession.id, content: text });
          input.value = '';
          input.disabled = false;
          commentsCount++;
          card.querySelector('[data-action="comment"] span').innerText = formatNumber(commentsCount);
          loadComments();
        } catch (err) {
          input.disabled = false;
          showToast(err.message || 'Failed to post comment');
        }
      });
      return;
    }

    if (action === 'like') {
      try {
        isLiked = !isLiked;
        likesCount += isLiked ? 1 : -1;
        actionBtn.classList.toggle('post-card__action--liked', isLiked);
        actionBtn.innerHTML = `${isLiked ? icon('heartFilled') : icon('heart')}<span class="likes-count">${formatNumber(likesCount)}</span>`;
        if (isLiked && actionBtn.querySelector('.icon')) {
          actionBtn.querySelector('.icon').style.animation = 'heartBeat 400ms ease';
        }

        const res = await api.toggleConfessionLike(confession.id);
        if (res && typeof res.count === 'number') {
          likesCount = res.count;
          isLiked = res.liked;
          actionBtn.querySelector('.likes-count').innerText = formatNumber(likesCount);
        }
      } catch {
        showToast('Could not like confession');
      }
    }

    if (action === 'report') {
      const reason = prompt('Reason for reporting this confession:');
      if (reason && reason.trim()) {
        try {
          await api.submitReport({
            targetType: 'confession',
            targetId: confession.id,
            reason: reason.trim()
          });
          showToast('Thank you. Confession reported for moderator review.');
        } catch {
          showToast('Report submitted');
        }
      }
    }
  });

  return card;
}
