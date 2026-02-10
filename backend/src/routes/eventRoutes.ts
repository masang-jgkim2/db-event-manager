import { Router } from 'express';
import { fnGetEvents, fnCreateEvent, fnUpdateEvent, fnDeleteEvent } from '../controllers/eventController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnAdminOnly } from '../middleware/roleMiddleware';

const router = Router();

// GET /api/events - 목록 조회 (인증 사용자 전체)
router.get('/', fnAuthMiddleware, fnGetEvents);

// POST /api/events - 추가 (관리자)
router.post('/', fnAuthMiddleware, fnAdminOnly, fnCreateEvent);

// PUT /api/events/:id - 수정 (관리자)
router.put('/:id', fnAuthMiddleware, fnAdminOnly, fnUpdateEvent);

// DELETE /api/events/:id - 삭제 (관리자)
router.delete('/:id', fnAuthMiddleware, fnAdminOnly, fnDeleteEvent);

export default router;
