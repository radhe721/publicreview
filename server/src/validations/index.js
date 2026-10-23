import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot exceed 50 characters'),
  email: z.string().trim().email('Invalid email address').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  bio: z.string().max(250).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const createIdeaSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(60, 'Title cannot exceed 60 characters'),
  pitch: z.string().trim().min(10, 'Pitch must be at least 10 characters').max(100, 'Pitch cannot exceed 100 characters'),
  description: z.string().trim().min(20, 'Description must be at least 20 characters').max(5000, 'Description cannot exceed 5000 characters'),
  category: z.enum(['Tech', 'Business', 'Design', 'Social', 'Education', 'Other'], {
    errorMap: () => ({ message: 'Category must be one of: Tech, Business, Design, Social, Education, Other' })
  }),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional().default([]),
  cover_image: z.string().trim().url().optional().nullable().or(z.literal(''))
});

export const updateIdeaSchema = createIdeaSchema.partial();

export const rateIdeaSchema = z.object({
  score: z.number().int({ message: 'Score must be an integer' }).min(1, 'Score must be at least 1').max(5, 'Score cannot exceed 5'),
  review_text: z.string().trim().max(1000, 'Review cannot exceed 1000 characters').optional().nullable()
});

export const commentSchema = z.object({
  content: z.string().trim().min(2, 'Comment must be at least 2 characters').max(1000, 'Comment cannot exceed 1000 characters'),
  parent_id: z.number().int().positive().optional().nullable()
});

export const reportSchema = z.object({
  idea_id: z.number().int().positive('Idea ID must be a valid positive integer'),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500, 'Reason cannot exceed 500 characters')
});

export const updateReportSchema = z.object({
  status: z.enum(['pending', 'resolved', 'dismissed'])
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  sort: z.string().trim().optional().default('top'),
  time_window: z.string().trim().optional(),
  timeframe: z.string().trim().optional(),
  tag: z.string().trim().optional()
});
