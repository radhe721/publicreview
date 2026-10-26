import { Router } from 'express';
import {
  getIdeas,
  getIdeaById,
  createIdea,
  updateIdea,
  deleteIdea
} from '../controllers/idea.controller.js';
import {
  getIdeaRatings,
  getMyIdeaRating,
  submitOrUpdateRating,
  deleteRating
} from '../controllers/rating.controller.js';
import {
  getIdeaComments,
  createComment,
  deleteComment
} from '../controllers/comment.controller.js';
import {
  getDemand,
  submitDemand,
  deleteDemand,
  getWaitlist
} from '../controllers/demand.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createIdeaSchema,
  updateIdeaSchema,
  rateIdeaSchema,
  commentSchema,
  paginationQuerySchema,
  demandSignalSchema
} from '../validations/index.js';

const router = Router();

// Ideas Endpoints
router.get('/', validate(paginationQuerySchema, 'query'), getIdeas);
router.get('/:id', optionalAuth, getIdeaById);
router.post('/', requireAuth, validate(createIdeaSchema), createIdea);
router.put('/:id', requireAuth, validate(updateIdeaSchema), updateIdea);
router.delete('/:id', requireAuth, deleteIdea);

// Ratings Endpoints on an Idea
router.get('/:id/ratings', getIdeaRatings);
router.get('/:id/ratings/my', requireAuth, getMyIdeaRating);
router.post('/:id/ratings', requireAuth, validate(rateIdeaSchema), submitOrUpdateRating);
router.delete('/:id/ratings', requireAuth, deleteRating);

// Demand validation ("would you use / pay for this?") and creator waitlist
router.get('/:id/demand', optionalAuth, getDemand);
router.put('/:id/demand', requireAuth, validate(demandSignalSchema), submitDemand);
router.delete('/:id/demand', requireAuth, deleteDemand);
router.get('/:id/demand/waitlist', requireAuth, getWaitlist);

// Comments Endpoints on an Idea
router.get('/:id/comments', getIdeaComments);
router.post('/:id/comments', requireAuth, validate(commentSchema), createComment);
router.delete('/comments/:commentId', requireAuth, deleteComment);

export default router;
