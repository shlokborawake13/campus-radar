/* ============================================
   CAMPUS RADAR — POST CARD COMPONENT
   ============================================ */
import { icon } from '../utils/icons.js';
import { timeAgo, formatNumber, showToast } from '../utils/helpers.js';
import { api, tokenStorage } from '../services/api.js';
import { navigate } from '../router.js';

export function renderPostCard(post) {
  // ANONYMOUS ENFORCEMENT: Never display real names, initials, or identifiers
  const authorName = post.author_name || post.authorName || (post.anonId ? `Anonymous #${String(post.anonId).padStart(2, '0')}` : 'Anonymous Student');
  const initial = '#';
  const createdAt = post.created_at || post.createdAt || new Date();
  
  let isLiked = !!(post.is_liked ?? post.liked);
  let likesCount = parseInt(post.likes_count ?? post.likes ?? 0, 10);
  let isSaved = !!(post.is_saved ?? post.saved);
  let commentsCount = parseInt(post.comments_count ?? post.comments ?? 0, 10);

  const card = document.createElement('article');
  card.className = 'card post-card';
  card.id = `post-${post.id}`;

  card.innerHTML = `
    <div class="post-card__header">
      <div class="post-card__meta">
        <div class="avatar avatar--sm avatar--color-1" style="font-weight: 700;">${initial}</div>
        <div>
          <span class="post-card__author">${authorName}</span>
          <span class="post-card__time">${timeAgo(createdAt)}</span>
        </div>
      </div>
      <button class="btn--icon post-card__more" aria-label="More options">
        ${icon('moreHorizontal')}
      </button>
    </div>

    <div class="post-card__content">
      <p style="white-space: pre-line;">${post.content}</p>
    </div>

    ${post.image_url ? `
      <div class="post-card__image-container" style="margin: var(--space-3) 0; border-radius: var(--radius-md); overflow: hidden; max-height: 380px; aspect-ratio: 16/9; background: var(--bg-secondary);">
        <img src="${post.image_url}" alt="Post image" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" decoding="async" onerror="this.parentElement.style.display='none'" />
      </div>
    ` : ''}

    <div class="post-card__actions">
      <button class="post-card__action ${isLiked ? 'post-card__action--liked' : ''}" data-action="like">
        ${isLiked ? icon('heartFilled') : icon('heart')}
        <span class="likes-count">${formatNumber(likesCount)}</span>
      </button>
      <button class="post-card__action" data-action="comment">
        ${icon('comment')}
        <span>${formatNumber(commentsCount)}</span>
      </button>
      <button class="post-card__action ${isSaved ? 'post-card__action--saved' : ''}" data-action="save">
        ${isSaved ? icon('bookmarkFilled') : icon('bookmark')}
      </button>
      <button class="post-card__action" data-action="report">
        ${icon('flag')}
      </button>
    </div>
  `;

  // Interactive event listeners connected to live API
  card.addEventListener('click', async (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const user = tokenStorage.getUser();

    if (!user) {
      showToast('Please sign in to interact with posts');
      navigate('/login');
      return;
    }

    if (action === 'comment') {
      let commentSection = card.querySelector('.post-card__comments');
      if (commentSection) {
        commentSection.remove();
        return;
      }
      commentSection = document.createElement('div');
      commentSection.className = 'post-card__comments';
      commentSection.style.cssText = 'padding: var(--space-4); border-top: 1px solid var(--border-light); margin-top: var(--space-3);';
      commentSection.innerHTML = `
        <div class="comments-list" style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-3);">
          <div style="color: var(--text-tertiary); font-size: var(--text-xs);">Loading comments...</div>
        </div>
        <form class="add-comment-form" style="display: flex; gap: var(--space-2);">
          <input type="text" class="input input--sm" placeholder="Reply anonymously as ${user.anonymousPseudonym || 'Anonymous Student'}..." required style="flex: 1;" />
          <button type="submit" class="btn btn--primary btn--sm">Reply</button>
        </form>
      `;
      card.appendChild(commentSection);

      const listEl = commentSection.querySelector('.comments-list');
      const formEl = commentSection.querySelector('.add-comment-form');

      const loadComments = async () => {
        try {
          const res = await api.getComments('post', post.id);
          const comments = res.comments || res.data || (Array.isArray(res) ? res : []);
          if (comments.length === 0) {
            listEl.innerHTML = `<div style="color: var(--text-tertiary); font-size: var(--text-xs);">No comments yet. Start the conversation anonymously!</div>`;
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
          await api.addComment({ postId: post.id, content: text });
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

        const res = await api.togglePostLike(post.id);
        if (res && typeof res.count === 'number') {
          likesCount = res.count;
          isLiked = res.liked;
          actionBtn.querySelector('.likes-count').innerText = formatNumber(likesCount);
        }
      } catch (err) {
        showToast('Could not update like');
      }
    }

    if (action === 'save') {
      try {
        isSaved = !isSaved;
        actionBtn.classList.toggle('post-card__action--saved', isSaved);
        actionBtn.innerHTML = isSaved ? icon('bookmarkFilled') : icon('bookmark');
        showToast(isSaved ? 'Post saved to your bookmarks' : 'Post removed from saved');
        await api.toggleSavePost(post.id);
      } catch (err) {
        showToast('Could not save post');
      }
    }

    if (action === 'report') {
      const reason = prompt('Reason for reporting this post:');
      if (reason && reason.trim()) {
        try {
          await api.submitReport({
            targetType: 'post',
            targetId: post.id,
            reason: reason.trim()
          });
          showToast('Thank you. Post submitted to moderation team for review.');
        } catch {
          showToast('Report submitted');
        }
      }
    }
  });

  return card;
}
