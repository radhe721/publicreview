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
  similarTitles, similarIdeas, relatedRepos, getRevisions, myDrafts, trackView, getAnalytics,
  getBuilders, setBuildInterest, removeBuildInterest, markFeedbackHelpful, markLaunched, removeLaunch,
  verifyRevenue, listLaunches, getLanding, landingSignup, landingSignups
} from '../controllers/ideaExtras.controller.js';
import { getIdeaReport } from '../controllers/payments.controller.js';
import { toggleCommentUpvote } from '../controllers/community.controller.js';
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
  teamSeedSchema,
  launchSchema,
  verifyRevenueSchema,
  buildInterestSchema,
  landingSignupSchema
} from '../validations/index.js';

const router = Router();

// Ideas Endpoints (fixed paths before /:id)
router.get('/', validate(paginationQuerySchema, 'query'), getIdeas);
router.get('/similar-titles', similarTitles);
router.get('/drafts/mine', requireAuth, myDrafts);
router.get('/launches', listLaunches);
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

// Discovery, history and analytics
router.get('/:id/similar', similarIdeas);
router.get('/:id/repos', relatedRepos);
router.get('/:id/revisions', optionalAuth, getRevisions);
router.post('/:id/view', trackView);
router.get('/:id/analytics', requireAuth, getAnalytics);
router.get('/:id/report', requireAuth, getIdeaReport);

// Builders
router.get('/:id/build', optionalAuth, getBuilders);
router.put('/:id/build', requireAuth, validate(buildInterestSchema), setBuildInterest);
router.delete('/:id/build', requireAuth, removeBuildInterest);
router.post('/:id/feedback/:userId/helpful', requireAuth, markFeedbackHelpful);

// Launch tracking
router.put('/:id/launch', requireAuth, validate(launchSchema), markLaunched);
router.delete('/:id/launch', requireAuth, removeLaunch);
router.post('/:id/verify-revenue', requireAuth, voteLimiter, validate(verifyRevenueSchema), verifyRevenue);

// Pro fake-door landing page
router.get('/:id/landing', getLanding);
router.post('/:id/landing/signup', voteLimiter, validate(landingSignupSchema), landingSignup);
router.get('/:id/landing/signups', requireAuth, landingSignups);

// Comments Endpoints on an Idea
router.get('/:id/comments', optionalAuth, getIdeaComments);
router.post('/:id/comments', requireAuth, validate(commentSchema), createComment);
router.delete('/comments/:commentId', requireAuth, deleteComment);
router.post('/comments/:commentId/upvote', requireAuth, toggleCommentUpvote);
router.delete('/comments/:commentId/upvote', requireAuth, toggleCommentUpvote);

export default router;
