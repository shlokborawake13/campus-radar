/* ============================================
   CAMPUS RADAR — CREATE POST MODAL
   Live publishing for posts and anonymous confessions
   With Secure Verified Image Uploading
   ============================================ */
import { icon } from '../utils/icons.js';
import { navigate } from '../router.js';
import { showToast } from '../utils/helpers.js';
import { api, tokenStorage } from '../services/api.js';

export function renderCreatePostModal(container) {
  const user = tokenStorage.getUser();

  if (!user) {
    showToast('Please sign in to publish content');
    navigate('/login');
    return;
  }

  const isVerified = Boolean(user.emailVerified || user.email_verified || user.role === 'admin' || user.role === 'super_admin');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'create-post-modal';

  overlay.innerHTML = `
    <div class="modal" style="max-width: 540px;">
      <div class="modal__header">
        <h2 class="heading-card">Create something.</h2>
        <button class="btn--icon" id="close-modal" aria-label="Close">
          ${icon('close')}
        </button>
      </div>

      <div class="modal__body">
        <div class="create-post__types">
          <button class="pill pill--active" data-type="post">Campus Post</button>
          <button class="pill" data-type="confession">Anonymous Confession</button>
        </div>

        <div class="create-post__editor" style="margin-top: var(--space-3);">
          <textarea class="textarea" id="post-content" placeholder="What's happening on campus? Questions, updates, projects..." rows="4" maxlength="2000"></textarea>
        </div>

        <!-- Image Upload Section (Posts Only) -->
        <div id="image-upload-section" style="margin-top: var(--space-3);">
          ${
            isVerified
              ? `
            <div id="image-upload-dropzone" style="border: 1.5px dashed var(--border-color, #333); border-radius: 8px; padding: 12px; text-align: center; cursor: pointer; transition: border-color 0.2s; background: var(--bg-surface-secondary, rgba(255,255,255,0.02));">
              <input type="file" id="post-image-input" accept="image/jpeg,image/png,image/webp" style="display: none;" />
              <div id="dropzone-prompt" style="display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; color: var(--text-secondary);">
                <span>📷</span>
                <span>Attach an image (JPEG, PNG, WebP — max 5MB)</span>
              </div>
              <div id="upload-progress-container" style="display: none; margin-top: 8px;">
                <div style="width: 100%; height: 6px; background: var(--border-color, #333); border-radius: 3px; overflow: hidden;">
                  <div id="upload-progress-bar" style="width: 0%; height: 100%; background: var(--accent-primary, #6366f1); transition: width 0.2s;"></div>
                </div>
                <span id="upload-progress-text" style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px; display: inline-block;">Uploading... 0%</span>
              </div>
            </div>
            
            <div id="image-preview-container" style="display: none; margin-top: 10px; position: relative; border-radius: 8px; overflow: hidden; max-height: 220px; background: #000; border: 1px solid var(--border-color, #333);">
              <img id="image-preview-img" src="" alt="Post attachment preview" style="width: 100%; max-height: 220px; object-fit: contain;" />
              <button id="remove-image-btn" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.75); color: #fff; border: none; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px;">✕</button>
            </div>
          `
              : `
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 10px 14px; font-size: 12.5px; color: var(--text-secondary); display: flex; align-items: flex-start; gap: 10px;">
              <span style="font-size: 16px; line-height: 1;">🔒</span>
              <div>
                <strong style="color: var(--text-primary); display: block; margin-bottom: 2px;">Image Uploads Locked</strong>
                <span>Image uploads require a verified university account. Verify your email to unlock media attachments.</span>
              </div>
            </div>
          `
          }
        </div>

        <div class="create-post__identity" id="identity-preview" style="margin-top: var(--space-3); display: flex; align-items: center; gap: var(--space-2);">
          <div class="avatar avatar--sm" style="background: var(--accent-primary); color: white;">#</div>
          <span class="body-small">Posting as <strong>${user.anonymousPseudonym || 'Anonymous Student'}</strong></span>
        </div>
      </div>

      <div class="modal__footer">
        <button class="btn btn--ghost" id="cancel-post">Cancel</button>
        <button class="btn btn--primary" id="publish-post">Publish</button>
      </div>
    </div>
  `;

  let currentType = 'post';
  let uploadedImageUrl = null;
  let isUploading = false;

  const imageSection = overlay.querySelector('#image-upload-section');
  const imageInput = overlay.querySelector('#post-image-input');
  const dropzone = overlay.querySelector('#image-upload-dropzone');
  const previewContainer = overlay.querySelector('#image-preview-container');
  const previewImg = overlay.querySelector('#image-preview-img');
  const removeImageBtn = overlay.querySelector('#remove-image-btn');
  const progressContainer = overlay.querySelector('#upload-progress-container');
  const progressBar = overlay.querySelector('#upload-progress-bar');
  const progressText = overlay.querySelector('#upload-progress-text');
  const publishBtn = overlay.querySelector('#publish-post');

  // Wire dropzone & file picker if user is verified
  if (isVerified && dropzone && imageInput) {
    dropzone.addEventListener('click', (e) => {
      if (!isUploading && e.target !== removeImageBtn) {
        imageInput.click();
      }
    });

    imageInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Client-side validation
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        showToast('Invalid format. Only JPEG, PNG, and WebP images are allowed.');
        imageInput.value = '';
        return;
      }

      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (file.size > MAX_SIZE) {
        showToast('File size exceeds the 5 MB limit.');
        imageInput.value = '';
        return;
      }

      // Show immediate local preview
      const localPreviewUrl = URL.createObjectURL(file);
      if (previewContainer && previewImg) {
        previewImg.src = localPreviewUrl;
        previewContainer.style.display = 'block';
        dropzone.style.display = 'none';
      }

      try {
        isUploading = true;
        publishBtn.disabled = true;
        if (progressContainer) {
          progressContainer.style.display = 'block';
          progressBar.style.width = '10%';
          progressText.innerText = 'Uploading... 10%';
        }

        const res = await api.uploadImage(file, (percent) => {
          if (progressBar) progressBar.style.width = `${percent}%`;
          if (progressText) progressText.innerText = `Uploading... ${percent}%`;
        });

        uploadedImageUrl = res.upload?.url || res.url;
        showToast('Image uploaded and optimized successfully! ✨');
      } catch (err) {
        showToast(err.message || 'Image upload failed. Account must be verified.');
        imageInput.value = '';
        uploadedImageUrl = null;
        if (previewContainer) previewContainer.style.display = 'none';
        if (dropzone) dropzone.style.display = 'block';
      } finally {
        isUploading = false;
        publishBtn.disabled = false;
        if (progressContainer) {
          progressContainer.style.display = 'none';
        }
      }
    });

    if (removeImageBtn) {
      removeImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadedImageUrl = null;
        imageInput.value = '';
        if (previewContainer) previewContainer.style.display = 'none';
        if (dropzone) dropzone.style.display = 'block';
      });
    }
  }

  // Type toggle
  overlay.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (pill) {
      overlay.querySelectorAll('.pill').forEach(p => p.classList.remove('pill--active'));
      pill.classList.add('pill--active');
      currentType = pill.dataset.type;
      const textarea = overlay.querySelector('#post-content');
      const identityPreview = overlay.querySelector('#identity-preview');

      if (currentType === 'confession') {
        textarea.placeholder = 'Share your anonymous confession... (Identity is strictly protected)';
        identityPreview.innerHTML = `
          <div class="avatar avatar--sm" style="background: var(--text-tertiary); color: white;">🎭</div>
          <span class="body-small">Posting as <strong>Anonymous Pseudonym</strong> (e.g. Ghost Falcon)</span>
        `;
        if (imageSection) imageSection.style.display = 'none';
      } else {
        textarea.placeholder = "What's happening on campus? Questions, updates, projects...";
        identityPreview.innerHTML = `
          <div class="avatar avatar--sm" style="background: var(--accent-primary); color: white;">#</div>
          <span class="body-small">Posting as <strong>${user.anonymousPseudonym || 'Anonymous Student'}</strong></span>
        `;
        if (imageSection) imageSection.style.display = 'block';
      }
    }
  });

  // Close
  const close = () => {
    overlay.style.opacity = '0';
    overlay.querySelector('.modal').style.transform = 'scale(0.95)';
    setTimeout(() => {
      overlay.remove();
      if (window.location.hash === '#/create') {
        navigate(currentType === 'confession' ? '/confessions' : '/');
      }
    }, 150);
  };

  overlay.querySelector('#close-modal').addEventListener('click', close);
  overlay.querySelector('#cancel-post').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Publish
  publishBtn.addEventListener('click', async () => {
    if (isUploading) {
      showToast('Please wait for image upload to complete.');
      return;
    }

    const content = overlay.querySelector('#post-content').value.trim();

    if (!content && !uploadedImageUrl) {
      showToast('Please enter text or attach an image.');
      return;
    }

    try {
      publishBtn.disabled = true;
      publishBtn.innerText = 'Publishing...';

      if (currentType === 'confession') {
        await api.createConfession({ content, category: 'campus-life' });
        showToast('Confession posted anonymously! 🎭');
        close();
        navigate('/confessions');
      } else {
        await api.createPost({
          content: content || 'Shared an image',
          tag: 'general',
          imageUrl: uploadedImageUrl || null
        });
        showToast('Post published to campus feed! 🚀');
        close();
        navigate('/');
      }
    } catch (err) {
      showToast(err.message || 'Failed to publish');
      publishBtn.disabled = false;
      publishBtn.innerText = 'Publish';
    }
  });

  container.appendChild(overlay);
}
