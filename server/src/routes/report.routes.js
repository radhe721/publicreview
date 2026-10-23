import { Router } from 'express';
import {
  createReport,
  getReports,
  updateReportStatus
} from '../controllers/report.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { reportSchema, updateReportSchema } from '../validations/index.js';

const router = Router();

router.post('/', requireAuth, validate(reportSchema), createReport);
router.get('/', requireAuth, requireAdmin, getReports);
router.patch('/:id', requireAuth, requireAdmin, validate(updateReportSchema), updateReportStatus);

export default router;
