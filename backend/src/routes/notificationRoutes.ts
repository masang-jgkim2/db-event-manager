import { Router } from 'express';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import {
  fnGetNotifications,
  fnPatchNotificationRead,
  fnPatchNotificationsReadAll,
  fnPostNotification,
} from '../controllers/notificationsController';

const router = Router();

router.get('/', fnAuthMiddleware, fnGetNotifications);
router.post('/', fnAuthMiddleware, fnPostNotification);
router.patch('/read-all', fnAuthMiddleware, fnPatchNotificationsReadAll);
router.patch('/:strId/read', fnAuthMiddleware, fnPatchNotificationRead);

export default router;
