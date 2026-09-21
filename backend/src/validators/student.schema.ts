import { z } from 'zod';

const imageReferenceSchema = z
  .string()
  .min(1)
  .max(1000)
  .refine(
    (val) => val.startsWith('/uploads/') || /^https?:\/\/[^\s$.?#].[^\s]*$/.test(val),
    { message: 'Invalid image URL or storage path' }
  );

export const createPostSchema = z.object({
  content: z.string().min(1, 'Post content cannot be empty').max(3000, 'Post content is too long'),
  tag: z.string().max(50).default('general'),
  imageUrl: imageReferenceSchema.optional().nullable()
});

export const createConfessionSchema = z.object({
  content: z.string().min(5, 'Confession must be at least 5 characters').max(2000, 'Confession is too long'),
  category: z.string().max(50).default('campus-life')
});

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(1000, 'Comment is too long'),
  postId: z.string().uuid().optional(),
  confessionId: z.string().uuid().optional(),
  isAnonymous: z.boolean().default(false)
}).refine(data => (data.postId && !data.confessionId) || (!data.postId && data.confessionId), {
  message: 'Comment must belong to either a post or a confession, but not both'
});

export const createEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  category: z.enum(['hackathon', 'cultural', 'workshop', 'sports', 'seminar', 'general']),
  venue: z.string().min(2).max(200),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  eventTime: z.string().min(1).max(50),
  bannerUrl: imageReferenceSchema.optional().nullable(),
  capacity: z.number().int().min(1).max(10000).default(100)
});

export const createReportSchema = z.object({
  targetType: z.enum(['post', 'confession', 'comment', 'user']),
  targetId: z.string().uuid(),
  reason: z.string().min(3).max(100),
  details: z.string().max(1000).optional()
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  department: z.string().max(100).optional(),
  graduationYear: z.number().int().min(2020).max(2035).optional(),
  avatarUrl: imageReferenceSchema.optional().nullable()
});

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().optional().transform((v) => (v ? Math.min(parseInt(v, 10), 50) : 20)),
  category: z.string().optional(),
  tag: z.string().optional()
});
