import { Router } from 'express';
import {
  fnGetEvents, fnCreateEvent, fnUpdateEvent, fnDeleteEvent, fnGetEventInstancesByTemplate,
  fnUpdateEventStatus, fnUpdateEventQuery,
} from '../controllers/eventController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission, fnRequirePermission } from '../middleware/permissionMiddleware';

const router = Router();

// GET /api/events - 목록 조회 (보기/관리 등 또는 대시보드 보기 권한)
router.get('/', fnAuthMiddleware, fnRequireAnyPermission(
  'event_template.view', 'event_template.manage', 'event_template.create', 'event_template.edit', 'event_template.delete',
  'dashboard.view', 'my_dashboard.view', 'instance.view', 'instance.create',
), fnGetEvents);

// POST /api/events - 추가 (생성 또는 관리)
router.post('/', fnAuthMiddleware, fnRequireAnyPermission('event_template.manage', 'event_template.create'), fnCreateEvent);

// GET /api/events/:id/instances — 템플릿에 연결된 이벤트 인스턴스 목록
router.get('/:id/instances', fnAuthMiddleware, fnRequireAnyPermission(
  'event_template.view', 'event_template.manage', 'event_template.create', 'event_template.edit', 'event_template.delete',
  'my_dashboard.view',
), fnGetEventInstancesByTemplate);

// PUT /api/events/:id/query — DBA 리뷰 중 쿼리·세트만 수정
router.put('/:id/query', fnAuthMiddleware, fnRequireAnyPermission(
  'event_template.confirm', 'event_template.manage',
), fnUpdateEventQuery);

// PUT /api/events/:id - 수정 (수정 또는 관리)
router.put('/:id', fnAuthMiddleware, fnRequireAnyPermission('event_template.manage', 'event_template.edit'), fnUpdateEvent);

// PATCH /api/events/:id/status — 템플릿 워크플로 (리뷰 요청·DBA 승인)
router.patch('/:id/status', fnAuthMiddleware, fnRequireAnyPermission(
  'event_template.request_confirm', 'event_template.confirm', 'event_template.manage',
), fnUpdateEventStatus);

// DELETE /api/events/:id - 삭제 (삭제 또는 관리)
router.delete('/:id', fnAuthMiddleware, fnRequireAnyPermission('event_template.manage', 'event_template.delete'), fnDeleteEvent);

export default router;
