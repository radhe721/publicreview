import { z } from 'zod';
import { parseGithubRepo } from '../services/github.js';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot exceed 50 characters'),
  email: z.string().trim().email('Invalid email address').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password cannot exceed 72 characters'),
  bio: z.string().max(250).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(100),
  password: z.string().min(1, 'Password is required').max(200)
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(100)
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().regex(/^[a-f0-9]{64}$/, 'Invalid or expired reset link'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password cannot exceed 72 characters')
});

export const oauthProviderSchema = z.object({
  provider: z.enum(['google', 'github'])
});

export const demandSignalSchema = z.object({
  intent: z.enum(['pass', 'maybe', 'would_pay']),
  price_tier: z.enum(['under_10', '10_to_30', '30_to_100', 'over_100']).optional().nullable(),
  join_waitlist: z.boolean().optional().default(false)
}).transform((data) => ({
  ...data,
  // A price only makes sense alongside willingness to pay.
  price_tier: data.intent === 'would_pay' ? (data.price_tier || null) : null,
  // Nobody who passed on the idea should end up on its waitlist.
  join_waitlist: data.intent === 'pass' ? false : data.join_waitlist
}));

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
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().optional(),
  sort: z.string().trim().optional().default('top'),
  time_window: z.string().trim().optional(),
  timeframe: z.string().trim().optional(),
  tag: z.string().trim().optional()
});

export const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address').max(100),
  name: z.string().trim().max(80).optional().nullable(),
  use_case: z.string().trim().max(300).optional().nullable(),
  source: z.string().trim().max(40).optional().nullable(),
  // Honeypot: hidden from people, filled in by bots.
  website: z.string().max(0, 'Invalid submission').optional()
});

export const shareRepoSchema = z.object({
  url: z.string().trim().max(300)
    .refine((v) => parseGithubRepo(v) !== null, 'Enter a GitHub repository link, like https://github.com/owner/repo'),
  note: z.string().trim().max(280, 'Note cannot exceed 280 characters').optional().nullable()
});

export const repoListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['top', 'newest']).optional().default('top')
});
