import { Router } from 'express';
import { getPaymentsConfig, createCheckout, myPlan, getPublicReport, reportBadge } from '../controllers/payments.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { checkoutSchema } from '../validations/index.js';

const router = Router();

router.get('/payments/config', getPaymentsConfig);
router.post('/payments/checkout', requireAuth, validate(checkoutSchema), createCheckout);
router.get('/payments/me', requireAuth, myPlan);
router.get('/reports/public/:token', getPublicReport);
router.get('/reports/public/:token/badge.svg', reportBadge);

export default router;
