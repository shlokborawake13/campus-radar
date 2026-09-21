import { Router } from 'express';
import multer from 'multer';
import { studentController } from '../controllers/student.controller.js';
import { uploadController } from '../controllers/upload.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { requireVerifiedUser } from '../middleware/requireVerified.js';
import { validate } from '../middleware/validate.js';
import { postCreationLimiter, uploadLimiter } from '../config/rateLimit.js';

// Multer memory storage configuration (Max 5MB buffer in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});
import {
  createPostSchema,
  createConfessionSchema,
  createCommentSchema,
  createEventSchema,
  createReportSchema,
  updateProfileSchema
} from '../validators/student.schema.js';

const router = Router();

// --- Public / Optional Auth Read Routes ---
// Allows visitors to view the campus feed, events, and confessions even before logging in
router.get('/posts', optionalAuth, studentController.getFeed);
router.get('/posts/trending', optionalAuth, studentController.getTrending);
router.get('/posts/:id', optionalAuth, studentController.getPostById);

router.get('/confessions', optionalAuth, studentController.getConfessions);
router.get('/confessions/:id', optionalAuth, studentController.getConfessionById);

router.get('/events', optionalAuth, studentController.listEvents);
router.get('/events/:id', optionalAuth, studentController.getEventById);

router.get('/comments', optionalAuth, studentController.getComments);

// --- Protected Routes (Require Authentication & Active Student Status) ---
router.use(requireAuth);

// --- Secure Image Upload (Strictly Requires Verified Account) ---
router.post(
  '/uploads/images',
  requireVerifiedUser,
  uploadLimiter,
  upload.single('image'),
  uploadController.uploadImage
);
router.post(
  '/upload',
  requireVerifiedUser,
  uploadLimiter,
  upload.single('image'),
  uploadController.uploadImage
);

// Posts
router.post(
  '/posts',
  postCreationLimiter,
  validate({ body: createPostSchema }),
  studentController.createPost
);
router.delete('/posts/:id', studentController.deletePost);

// Confessions
router.post(
  '/confessions',
  postCreationLimiter,
  validate({ body: createConfessionSchema }),
  studentController.createConfession
);

// Comments
router.post(
  '/comments',
  validate({ body: createCommentSchema }),
  studentController.addComment
);
router.delete('/comments/:id', studentController.deleteComment);

// Likes & Saves
router.post('/posts/:id/like', studentController.togglePostLike);
router.post('/posts/:id/save', studentController.toggleSavePost);
router.get('/saved', studentController.getSavedPosts);
router.post('/confessions/:id/like', studentController.toggleConfessionLike);

// Events
router.post(
  '/events',
  validate({ body: createEventSchema }),
  studentController.createEvent
);
router.post('/events/:id/register', studentController.registerForEvent);

// Reports
router.post(
  '/reports',
  validate({ body: createReportSchema }),
  studentController.submitReport
);

// Profiles
router.get('/profile/me', studentController.getProfile);
router.get('/profile/:id', studentController.getProfile);
router.patch(
  '/profile/me',
  validate({ body: updateProfileSchema }),
  studentController.updateProfile
);

export default router;
