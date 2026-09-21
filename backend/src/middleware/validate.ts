import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { BadRequestError } from '../utils/errors.js';
import { sanitizeObject } from '../security/sanitize.js';

interface ValidationTargets {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

export function validate(schemas: ValidationTargets) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        // Sanitize string fields in body before validation
        const sanitizedBody = sanitizeObject(req.body);
        req.body = await schemas.body.parseAsync(sanitizedBody);
      }
      if (schemas.query) {
        // Sanitize query string parameters before validation
        const sanitizedQuery = sanitizeObject(req.query as Record<string, any>);
        req.query = await schemas.query.parseAsync(sanitizedQuery);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return next(new BadRequestError(`Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`));
      }
      next(err);
    }
  };
}
