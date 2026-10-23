import { Router } from 'express';
import {
  getUserProfile,
  getUserIdeas,
  getUserRatings
} from '../controllers/user.controller.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/:id', optionalAuth, getUserProfile);
router.get('/:id/ideas', getUserIdeas);
router.get('/:id/ratings', getUserRatings);

export default router;
