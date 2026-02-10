import { Router } from 'express';
import {
  fnCreateInstance, fnGetInstances,
  fnUpdateStatus, fnGetInstance,
} from '../controllers/eventInstanceController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';

const router = Router();

// 모든 라우트 인증 필수
router.use(fnAuthMiddleware);

// GET /api/event-instances - 목록 조회 (?filter=all|mine|dba_pending|my_pending)
router.get('/', fnGetInstances);

// GET /api/event-instances/:id - 단건 조회
router.get('/:id', fnGetInstance);

// POST /api/event-instances - 이벤트 생성
router.post('/', fnCreateInstance);

// PATCH /api/event-instances/:id/status - 상태 변경
router.patch('/:id/status', fnUpdateStatus);

export default router;
