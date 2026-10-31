import { Router } from 'express';
import {
  getUserProfile,
  getUserIdeas,
  getUserRatings,
  updateMyProfile
} from '../controllers/user.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema } from '../validations/index.js';

const router = Router();

router.patch('/me', requireAuth, validate(updateProfileSchema), updateMyProfile);
router.get('/:id', optionalAuth, getUserProfile);
router.get('/:id/ideas', getUserIdeas);
router.get('/:id/ratings', getUserRatings);

export default router;
