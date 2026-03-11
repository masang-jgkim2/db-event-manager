import { Router } from 'express';
import { fnGetEvents, fnCreateEvent, fnUpdateEvent, fnDeleteEvent } from '../controllers/eventController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission, fnRequirePermission } from '../middleware/permissionMiddleware';

const router = Router();

// GET /api/events - 목록 조회 (조회 또는 관리 권한)
router.get('/', fnAuthMiddleware, fnRequireAnyPermission('event_template.view', 'event_template.manage'), fnGetEvents);

// POST /api/events - 추가 (관리 권한)
router.post('/', fnAuthMiddleware, fnRequirePermission('event_template.manage'), fnCreateEvent);

// PUT /api/events/:id - 수정 (관리 권한)
router.put('/:id', fnAuthMiddleware, fnRequirePermission('event_template.manage'), fnUpdateEvent);

// DELETE /api/events/:id - 삭제 (관리 권한)
router.delete('/:id', fnAuthMiddleware, fnRequirePermission('event_template.manage'), fnDeleteEvent);

export default router;
