import { Router } from 'express';
import {
  getIdeas,
  getIdeaById,
  createIdea,
  updateIdea,
  deleteIdea,
  setTeamSeed
} from '../controllers/idea.controller.js';
import { getFeedback, submitFeedback, deleteFeedback } from '../controllers/feedback.controller.js';
import { voteLimiter, ideaPostLimiter } from '../middleware/rateLimiter.js';
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
import { requireAuth, optionalAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createIdeaSchema,
  updateIdeaSchema,
  rateIdeaSchema,
  commentSchema,
  paginationQuerySchema,
  demandSignalSchema,
  feedbackSchema,
  teamSeedSchema
} from '../validations/index.js';

const router = Router();

// Ideas Endpoints
router.get('/', validate(paginationQuerySchema, 'query'), getIdeas);
router.get('/:id', optionalAuth, getIdeaById);
router.post('/', requireAuth, ideaPostLimiter, validate(createIdeaSchema), createIdea);
router.put('/:id', requireAuth, validate(updateIdeaSchema), updateIdea);
router.delete('/:id', requireAuth, deleteIdea);
router.patch('/:id/team-seed', requireAuth, requireAdmin, validate(teamSeedSchema), setTeamSeed);

// Ratings Endpoints on an Idea
router.get('/:id/ratings', getIdeaRatings);
router.get('/:id/ratings/my', requireAuth, getMyIdeaRating);
router.post('/:id/ratings', requireAuth, voteLimiter, validate(rateIdeaSchema), submitOrUpdateRating);
router.delete('/:id/ratings', requireAuth, deleteRating);

// Demand validation ("would you use / pay for this?") and creator waitlist
router.get('/:id/demand', optionalAuth, getDemand);
router.put('/:id/demand', requireAuth, voteLimiter, validate(demandSignalSchema), submitDemand);
router.delete('/:id/demand', requireAuth, deleteDemand);
router.get('/:id/demand/waitlist', requireAuth, getWaitlist);

// Structured feedback (four quick questions + "what would make you pay?")
router.get('/:id/feedback', optionalAuth, getFeedback);
router.put('/:id/feedback', requireAuth, voteLimiter, validate(feedbackSchema), submitFeedback);
router.delete('/:id/feedback', requireAuth, deleteFeedback);

// Comments Endpoints on an Idea
router.get('/:id/comments', getIdeaComments);
router.post('/:id/comments', requireAuth, validate(commentSchema), createComment);
router.delete('/comments/:commentId', requireAuth, deleteComment);

export default router;
