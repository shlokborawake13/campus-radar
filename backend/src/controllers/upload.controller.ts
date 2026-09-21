import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { uploadService } from '../services/upload.service.js';
import { BadRequestError } from '../utils/errors.js';

export const uploadController = {
  async uploadImage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file || !req.file.buffer) {
        throw new BadRequestError('No image file provided in request');
      }

      const uploadResult = await uploadService.processAndUploadImage(
        req.user!.id,
        req.file.buffer,
        req.file.originalname
      );

      res.status(201).json({
        message: 'Image uploaded successfully',
        upload: uploadResult
      });
    } catch (err) {
      next(err);
    }
  }
};
