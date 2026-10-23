import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller.js';
import { optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, loginLimiter } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema } from '../validations/index.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', optionalAuth, getMe);

export default router;
