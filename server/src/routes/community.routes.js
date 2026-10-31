import { Router } from 'express';
import {
  listNotifications, markNotificationsRead, getNotificationPrefs, updateNotificationPrefs,
  topContributors, userReputation, userRepos, userLaunches, listCofounders, upsertCofounder, deleteCofounder,
  search, trendingDiscussions, listRepoComments, createRepoComment, deleteRepoComment, createContentReport, unsubscribe
} from '../controllers/community.controller.js';
import { ideasForRepo } from '../controllers/ideaExtras.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { voteLimiter } from '../middleware/rateLimiter.js';
import { cofounderSchema, commentSchema, contentReportSchema, notificationPrefsSchema } from '../validations/index.js';

const router = Router();

router.get('/notifications', requireAuth, listNotifications);
router.post('/notifications/read', requireAuth, markNotificationsRead);
router.get('/notifications/prefs', requireAuth, getNotificationPrefs);
router.put('/notifications/prefs', requireAuth, validate(notificationPrefsSchema), updateNotificationPrefs);

router.get('/contributors', topContributors);
router.get('/users/:id/reputation', userReputation);
router.get('/users/:id/repos', userRepos);
router.get('/users/:id/launches', userLaunches);

router.get('/cofounders', optionalAuth, listCofounders);
router.put('/cofounders', requireAuth, validate(cofounderSchema), upsertCofounder);
router.delete('/cofounders', requireAuth, deleteCofounder);

router.get('/search', search);
router.get('/discussions', trendingDiscussions);

router.get('/repos/:id/comments', listRepoComments);
router.post('/repos/:id/comments', requireAuth, voteLimiter, validate(commentSchema), createRepoComment);
router.delete('/repo-comments/:commentId', requireAuth, deleteRepoComment);
router.get('/repos/:id/ideas', ideasForRepo);

router.post('/content-reports', requireAuth, validate(contentReportSchema), createContentReport);
router.post('/unsubscribe', unsubscribe);

export default router;
