import { Request, Response, Router } from 'express';
import {
  fnGetUsers, fnCreateUser, fnUpdateUser, fnDeleteUser, fnResetPassword,
} from '../controllers/userController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission } from '../middleware/permissionMiddleware';
import {
  fnRegisterUserPresenceStreamClient,
  fnUnregisterUserPresenceStreamClient,
} from '../services/sseBroadcaster';
import { fnBuildPresenceSnapshotRows } from '../services/userPresence';

const router = Router();

// GET /api/users/presence-stream — 접속 상태 실시간 (user.view)
router.get(
  '/presence-stream',
  fnAuthMiddleware,
  fnRequireAnyPermission('user.view', 'user.manage'),
  (req: Request, res: Response) => {
    const nUserId = req.user?.nId || 0;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ nUserId })}\n\n`);

    fnRegisterUserPresenceStreamClient(nUserId, res);

    const arrSnap = fnBuildPresenceSnapshotRows();
    res.write(`event: presence_snapshot\n`);
    res.write(`data: ${JSON.stringify({ arrRows: arrSnap })}\n\n`);

    const nHeartbeatInterval = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(nHeartbeatInterval);
      }
    }, 30_000);

    req.on('close', () => {
      clearInterval(nHeartbeatInterval);
      fnUnregisterUserPresenceStreamClient(nUserId, res);
      res.end();
    });
  },
);

router.use(fnAuthMiddleware);

// GET: 보기 권한. POST/PUT/DELETE/PATCH: 해당 액션 권한
router.get('/', fnRequireAnyPermission('user.view'), fnGetUsers);
router.post('/', fnRequireAnyPermission('user.create'), fnCreateUser);
router.put('/:id', fnRequireAnyPermission('user.edit'), fnUpdateUser);
router.delete('/:id', fnRequireAnyPermission('user.delete'), fnDeleteUser);
router.patch('/:id/password', fnRequireAnyPermission('user.reset_password'), fnResetPassword);

export default router;
