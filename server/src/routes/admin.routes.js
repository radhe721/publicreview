import { Router } from 'express';
import { getHeldVotes, reviewHeldVote } from '../controllers/admin.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { heldVoteActionSchema } from '../validations/index.js';

const router = Router();

router.get('/held-votes', requireAuth, requireAdmin, getHeldVotes);
router.post('/held-votes/:kind/:id', requireAuth, requireAdmin, validate(heldVoteActionSchema), reviewHeldVote);

export default router;
