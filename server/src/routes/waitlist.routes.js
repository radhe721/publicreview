import { Router } from 'express';
import { joinWaitlist, getWaitlistCount, getWaitlist, exportWaitlistCsv } from '../controllers/waitlist.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { waitlistLimiter } from '../middleware/rateLimiter.js';
import { waitlistSchema } from '../validations/index.js';

const router = Router();

router.post('/', waitlistLimiter, validate(waitlistSchema), joinWaitlist);
router.get('/count', getWaitlistCount);
router.get('/', requireAuth, requireAdmin, getWaitlist);
router.get('/export.csv', requireAuth, requireAdmin, exportWaitlistCsv);

export default router;
