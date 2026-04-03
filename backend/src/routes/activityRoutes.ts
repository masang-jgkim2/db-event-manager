import { Request, Response, Router } from 'express';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission } from '../middleware/permissionMiddleware';
import { fnGetActivityActors, fnGetActivityLogs } from '../controllers/activityController';
import {
  fnRegisterActivityStreamClient,
  fnUnregisterActivityStreamClient,
} from '../services/sseBroadcaster';

const router = Router();

// GET /api/activity/stream — 활동 로그 실시간 알림 (activity.view)
router.get('/stream', fnAuthMiddleware, fnRequireAnyPermission('activity.view'), (req: Request, res: Response) => {
  const nUserId = req.user?.nId || 0;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ nUserId })}\n\n`);

  fnRegisterActivityStreamClient(nUserId, res);

  const nHeartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(nHeartbeatInterval);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(nHeartbeatInterval);
    fnUnregisterActivityStreamClient(nUserId, res);
    res.end();
  });
});

router.use(fnAuthMiddleware);
router.get('/logs', fnRequireAnyPermission('activity.view'), fnGetActivityLogs);
router.get('/actors', fnRequireAnyPermission('activity.view'), fnGetActivityActors);

export default router;
