import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { postService } from '../services/post.service.js';
import { confessionService } from '../services/confession.service.js';
import { commentService } from '../services/comment.service.js';
import { likeService } from '../services/like.service.js';
import { eventService } from '../services/event.service.js';
import { reportService } from '../services/report.service.js';
import { profileService } from '../services/profile.service.js';

export const studentController = {
  // Posts
  async createPost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const post = await postService.createPost(req.user!.id, req.body);
      res.status(201).json({ message: 'Post created successfully', post });
    } catch (err) {
      next(err);
    }
  },

  async getFeed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { cursor, limit, tag } = req.query as any;
      const currentUserId = req.user?.id || '00000000-0000-0000-0000-000000000000';
      const feed = await postService.getFeed(currentUserId, cursor, limit, tag);
      res.status(200).json(feed);
    } catch (err) {
      next(err);
    }
  },

  async getPostById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id || '00000000-0000-0000-0000-000000000000';
      const post = await postService.getPostById(req.params.id as string, currentUserId);
      res.status(200).json({ post });
    } catch (err) {
      next(err);
    }
  },

  async deletePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await postService.deletePost(req.params.id as string, req.user!.id, req.user!.role);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getTrending(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id || '00000000-0000-0000-0000-000000000000';
      const trending = await postService.getTrendingPosts(currentUserId);
      res.status(200).json({ trending });
    } catch (err) {
      next(err);
    }
  },

  // Confessions
  async createConfession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const confession = await confessionService.createConfession(req.user!.id, req.body);
      res.status(201).json({ message: 'Confession posted anonymously', confession });
    } catch (err) {
      next(err);
    }
  },

  async getConfessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { cursor, limit, category } = req.query as any;
      const currentUserId = req.user?.id || '00000000-0000-0000-0000-000000000000';
      const feed = await confessionService.getConfessions(currentUserId, cursor, limit, category);
      res.status(200).json(feed);
    } catch (err) {
      next(err);
    }
  },

  async getConfessionById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id || '00000000-0000-0000-0000-000000000000';
      const confession = await confessionService.getConfessionById(req.params.id as string, currentUserId);
      res.status(200).json({ confession });
    } catch (err) {
      next(err);
    }
  },

  // Comments
  async addComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const comment = await commentService.addComment(req.user!.id, req.body);
      res.status(201).json({ message: 'Comment added', comment });
    } catch (err) {
      next(err);
    }
  },

  async getComments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const targetType = req.query.postId ? 'post' : 'confession';
      const targetId = (req.query.postId || req.query.confessionId) as string;
      const comments = await commentService.getComments(targetType, targetId);
      res.status(200).json({ comments });
    } catch (err) {
      next(err);
    }
  },

  async deleteComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await commentService.deleteComment(req.params.id as string, req.user!.id, req.user!.role);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  // Likes & Saves
  async togglePostLike(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await likeService.togglePostLike(req.user!.id, req.params.id as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async toggleConfessionLike(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await likeService.toggleConfessionLike(req.user!.id, req.params.id as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async toggleSavePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await likeService.toggleSavePost(req.user!.id, req.params.id as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getSavedPosts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const saved = await likeService.getSavedPosts(req.user!.id);
      res.status(200).json({ saved });
    } catch (err) {
      next(err);
    }
  },

  // Events
  async listEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as string;
      const currentUserId = req.user?.id || '00000000-0000-0000-0000-000000000000';
      const events = await eventService.listEvents(currentUserId, category);
      res.status(200).json({ events });
    } catch (err) {
      next(err);
    }
  },

  async getEventById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id || '00000000-0000-0000-0000-000000000000';
      const event = await eventService.getEventById(req.params.id as string, currentUserId);
      res.status(200).json({ event });
    } catch (err) {
      next(err);
    }
  },

  async createEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const event = await eventService.createEvent(req.user!.id, req.body);
      res.status(201).json({ message: 'Event created', event });
    } catch (err) {
      next(err);
    }
  },

  async registerForEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await eventService.registerForEvent(req.user!.id, req.params.id as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  // Reports
  async submitReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const report = await reportService.submitReport(req.user!.id, req.body);
      res.status(201).json({ message: 'Report received and submitted for review', report });
    } catch (err) {
      next(err);
    }
  },

  // Profiles
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const targetId = (req.params.id as string) || req.user!.id;
      const profile = await profileService.getProfile(targetId, req.user!.id);
      res.status(200).json(profile);
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const updated = await profileService.updateProfile(req.user!.id, req.body);
      res.status(200).json({ message: 'Profile updated', user: updated });
    } catch (err) {
      next(err);
    }
  }
};
