import { Router } from 'express';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import {
  fnDeletePushSubscribe,
  fnGetPushVapidPublicKey,
  fnPostPushSubscribe,
} from '../controllers/pushController';

const router = Router();

router.get('/vapid-public-key', fnGetPushVapidPublicKey);
router.post('/subscribe', fnAuthMiddleware, fnPostPushSubscribe);
router.delete('/subscribe', fnAuthMiddleware, fnDeletePushSubscribe);

export default router;
