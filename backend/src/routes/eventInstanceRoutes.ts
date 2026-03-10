import { Router } from 'express';
import {
  fnCreateInstance, fnGetInstances,
  fnUpdateStatus, fnGetInstance, fnUpdateInstance,
  fnExecuteAndDeploy,
} from '../controllers/eventInstanceController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission } from '../middleware/permissionMiddleware';

const router = Router();

// 모든 라우트 인증 필수
router.use(fnAuthMiddleware);

// GET /api/event-instances - 목록 조회
router.get('/', fnGetInstances);

// GET /api/event-instances/:id - 단건 조회
router.get('/:id', fnGetInstance);

// POST /api/event-instances - 이벤트 생성
router.post('/', fnCreateInstance);

// PUT /api/event-instances/:id - 이벤트 수정 (event_created 상태에서만)
router.put('/:id', fnUpdateInstance);

// PATCH /api/event-instances/:id/status - 상태 변경
router.patch('/:id/status', fnUpdateStatus);

// POST /api/event-instances/:id/execute - QA/LIVE DB 쿼리 실행 (핵심)
router.post(
  '/:id/execute',
  fnRequireAnyPermission('instance.execute_qa', 'instance.execute_live'),
  fnExecuteAndDeploy
);

export default router;
