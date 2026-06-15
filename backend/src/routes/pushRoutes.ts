import { Router } from 'express';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import {
  fnDeletePushSubscribe,
  fnGetPushStatus,
  fnGetPushVapidPublicKey,
  fnPostPushSubscribe,
} from '../controllers/pushController';

const router = Router();

router.get('/vapid-public-key', fnGetPushVapidPublicKey);
router.get('/status', fnAuthMiddleware, fnGetPushStatus);
router.post('/subscribe', fnAuthMiddleware, fnPostPushSubscribe);
router.delete('/subscribe', fnAuthMiddleware, fnDeletePushSubscribe);

export default router;
