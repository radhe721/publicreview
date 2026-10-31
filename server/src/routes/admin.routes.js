import { Router } from 'express';
import { getHeldVotes, reviewHeldVote, getOverview, updateIdeaAdmin, setHidden, resolveContentReport } from '../controllers/admin.controller.js';
import { grant } from '../controllers/payments.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { heldVoteActionSchema, adminIdeaSchema, adminHideSchema, grantSchema } from '../validations/index.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/overview', getOverview);
router.get('/held-votes', getHeldVotes);
router.post('/held-votes/:kind/:id', validate(heldVoteActionSchema), reviewHeldVote);
router.patch('/ideas/:id', validate(adminIdeaSchema), updateIdeaAdmin);
router.patch('/hide/:type/:id', validate(adminHideSchema), setHidden);
router.patch('/content-reports/:id', resolveContentReport);
router.post('/grant', validate(grantSchema), grant);

export default router;
