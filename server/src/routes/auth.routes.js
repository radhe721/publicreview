import { Router } from 'express';
import { register, login, logout, logoutAll, getMe, forgotPassword, resetPassword } from '../controllers/auth.controller.js';
import { getProviders, startOAuth, oauthCallback } from '../controllers/oauth.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, loginLimiter, oauthLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, oauthProviderSchema } from '../validations/index.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.post('/logout-all', requireAuth, logoutAll);
router.get('/me', optionalAuth, getMe);
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);

// OAuth (Google, GitHub, X, LinkedIn)
router.get('/providers', getProviders);
router.get('/oauth/:provider', oauthLimiter, optionalAuth, validate(oauthProviderSchema, 'params'), startOAuth);
router.get('/oauth/:provider/callback', oauthLimiter, validate(oauthProviderSchema, 'params'), oauthCallback);

export default router;
