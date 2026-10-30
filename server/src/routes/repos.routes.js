import { Router } from 'express';
import {
  getRepos,
  shareRepo,
  upvoteRepo,
  removeRepoUpvote,
  deleteRepo
} from '../controllers/repo.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { repoShareLimiter } from '../middleware/rateLimiter.js';
import { shareRepoSchema, repoListQuerySchema } from '../validations/index.js';

const router = Router();

router.get('/', optionalAuth, validate(repoListQuerySchema, 'query'), getRepos);
router.post('/', requireAuth, repoShareLimiter, validate(shareRepoSchema), shareRepo);
router.delete('/:id', requireAuth, deleteRepo);

router.post('/:id/upvote', requireAuth, upvoteRepo);
router.delete('/:id/upvote', requireAuth, removeRepoUpvote);

export default router;
