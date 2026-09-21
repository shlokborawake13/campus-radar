import { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service.js';
import { AuthenticatedRequest } from '../types/index.js';

export const adminController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, totpCode } = req.body;
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip || req.socket.remoteAddress;
      const result = await adminService.adminLogin(email, password, totpCode, userAgent, ipAddress);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async confirmMfa(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, totpCode } = req.body;
      const result = await adminService.confirmMfaSetup(userId, totpCode);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getStats(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getDashboardOverview();
      res.status(200).json(stats);
    } catch (err) {
      next(err);
    }
  },

  async getOverview(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getDashboardOverview();
      res.status(200).json(stats);
    } catch (err) {
      next(err);
    }
  },

  async getActivity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const activity = await adminService.getRecentActivity(limit);
      res.status(200).json({ activity });
    } catch (err) {
      next(err);
    }
  },

  async listPosts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { search, status, limit, offset } = req.query as any;
      const posts = await adminService.listPosts(
        search,
        status,
        limit ? parseInt(limit, 10) : 50,
        offset ? parseInt(offset, 10) : 0
      );
      res.status(200).json({ posts });
    } catch (err) {
      next(err);
    }
  },

  async deletePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.deletePost(req.params.id as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async listConfessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { search, limit, offset } = req.query as any;
      const confessions = await adminService.listConfessions(
        search,
        limit ? parseInt(limit, 10) : 50,
        offset ? parseInt(offset, 10) : 0
      );
      res.status(200).json({ confessions });
    } catch (err) {
      next(err);
    }
  },

  async deleteConfession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.deleteConfession(req.params.id as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async listEvents(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { search, status, limit, offset } = req.query as any;
      const events = await adminService.listEvents(
        search,
        status,
        limit ? parseInt(limit, 10) : 50,
        offset ? parseInt(offset, 10) : 0
      );
      res.status(200).json({ events });
    } catch (err) {
      next(err);
    }
  },

  async createEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const event = await adminService.createEvent(req.body, req.user!.id);
      res.status(201).json({ message: 'Event created successfully', event });
    } catch (err) {
      next(err);
    }
  },

  async deleteEvent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminService.deleteEvent(req.params.id as string);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getAnalytics(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const analytics = await adminService.getAnalytics();
      res.status(200).json(analytics);
    } catch (err) {
      next(err);
    }
  },

  async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { search, role, status, limit } = req.query as any;
      const users = await adminService.listUsers(search, role, status, limit ? parseInt(limit, 10) : 50);
      res.status(200).json({ users });
    } catch (err) {
      next(err);
    }
  },

  async updateUserStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const updated = await adminService.updateUserStatus(req.params.id as string, status, req.user!.id);
      res.status(200).json({ message: 'User status updated', user: updated });
    } catch (err) {
      next(err);
    }
  },

  async updateUserRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { role } = req.body;
      const updated = await adminService.updateUserRole(req.params.id as string, role, req.user!.role);
      res.status(200).json({ message: 'User role updated', user: updated });
    } catch (err) {
      next(err);
    }
  },

  async listModerationQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const status = (req.query.status as string) || 'auto_flagged';
      const items = await adminService.listModerationQueue(status);
      res.status(200).json({ queue: items });
    } catch (err) {
      next(err);
    }
  },

  async reviewModeration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { status, reviewNotes } = req.body;
      const result = await adminService.reviewModerationItem(req.params.id as string, req.user!.id, status, reviewNotes);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async listReports(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const status = (req.query.status as string) || 'pending';
      const reports = await adminService.listReports(status);
      res.status(200).json({ reports });
    } catch (err) {
      next(err);
    }
  },

  async resolveReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { status, actionNotes, actionToTake } = req.body;
      const result = await adminService.resolveReport(req.params.id as string, req.user!.id, status, actionNotes, actionToTake);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async listAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const logs = await adminService.listAuditLogs(limit);
      res.status(200).json({ logs });
    } catch (err) {
      next(err);
    }
  }
};

