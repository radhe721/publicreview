import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many requests. Please try again later.' }
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many authentication attempts. Please try again later.' }
  }
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.LOGIN_RATE_LIMIT ? parseInt(process.env.LOGIN_RATE_LIMIT, 10) : (process.env.NODE_ENV === 'test' ? 5 : 10),
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    error: { message: 'Too many login attempts. Please try again after 15 minutes.' }
  }
});

// Each request can send an email, so this is tighter than the general auth budget.
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many password reset requests. Please try again later.' }
  }
});

// OAuth start + callback are two requests per sign-in, so this budget is a bit larger.
export const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many sign-in attempts. Please try again later.' }
  }
});

export const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many signups from this network. Please try again later.' }
  }
});

// Each share calls the GitHub API, which has its own hourly budget for this server.
export const repoShareLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'You have shared a lot of repos this hour. Please try again later.' }
  }
});

const isTest = process.env.NODE_ENV === 'test';

// Voting (ratings, demand, feedback): generous for real people, a wall for scripts.
export const voteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'You are voting very fast. Please take a short break and try again.' }
  }
});

export const ideaPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTest ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'You have posted a lot of ideas this hour. Please try again later.' }
  }
});
