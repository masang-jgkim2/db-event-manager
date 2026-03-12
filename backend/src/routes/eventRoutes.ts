import { Router } from 'express';
import { fnGetEvents, fnCreateEvent, fnUpdateEvent, fnDeleteEvent } from '../controllers/eventController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission, fnRequirePermission } from '../middleware/permissionMiddleware';

const router = Router();

// GET /api/events - 목록 조회 (보기/생성/수정/삭제/관리 중 하나)
router.get('/', fnAuthMiddleware, fnRequireAnyPermission('event_template.view', 'event_template.manage', 'event_template.create', 'event_template.edit', 'event_template.delete'), fnGetEvents);

// POST /api/events - 추가 (생성 또는 관리)
router.post('/', fnAuthMiddleware, fnRequireAnyPermission('event_template.manage', 'event_template.create'), fnCreateEvent);

// PUT /api/events/:id - 수정 (수정 또는 관리)
router.put('/:id', fnAuthMiddleware, fnRequireAnyPermission('event_template.manage', 'event_template.edit'), fnUpdateEvent);

// DELETE /api/events/:id - 삭제 (삭제 또는 관리)
router.delete('/:id', fnAuthMiddleware, fnRequireAnyPermission('event_template.manage', 'event_template.delete'), fnDeleteEvent);

export default router;
