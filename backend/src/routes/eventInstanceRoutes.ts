import { Router, Request, Response } from 'express';
import {
  fnCreateInstance, fnGetInstances,
  fnUpdateStatus, fnGetInstance, fnUpdateInstance,
  fnExecuteAndDeploy, fnGetTemplateExecElapsed, fnDeleteInstance,
} from '../controllers/eventInstanceController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission } from '../middleware/permissionMiddleware';
import {
  fnRegisterClient, fnUnregisterClient, fnGetClientCount,
} from '../services/sseBroadcaster';

const router = Router();

// ──────────────────────────────────────────────────────────
// SSE 스트림 연결 - 인증 필요 (라우터 use 보다 먼저 선언)
// GET /api/event-instances/stream (나의 대시보드 보기 권한)
// ──────────────────────────────────────────────────────────
router.get('/stream', fnAuthMiddleware, fnRequireAnyPermission('my_dashboard.view'), (req: Request, res: Response) => {
  const nUserId = req.user?.nId || 0;

  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx 프록시 버퍼링 비활성화
  res.flushHeaders();

  // 연결 확인 이벤트
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ nUserId, nClientCount: fnGetClientCount() + 1 })}\n\n`);

  // 클라이언트 등록
  fnRegisterClient(nUserId, res);

  // 30초마다 heartbeat (프록시 타임아웃 방지)
  const nHeartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(nHeartbeatInterval);
    }
  }, 30000);

  // 연결 종료 시 정리
  req.on('close', () => {
    clearInterval(nHeartbeatInterval);
    fnUnregisterClient(nUserId, res);
    res.end();
  });
});

// 모든 나머지 라우트 인증 필수
router.use(fnAuthMiddleware);

// GET /api/event-instances - 목록 조회 (나의 대시보드 보기 권한)
router.get('/', fnRequireAnyPermission('my_dashboard.view'), fnGetInstances);

// GET /api/event-instances/template-exec-elapsed — :id 보다 먼저 등록 (프로그레스 바용)
router.get('/template-exec-elapsed', fnRequireAnyPermission('my_dashboard.view'), fnGetTemplateExecElapsed);

// GET /api/event-instances/:id - 단건 조회 (나의 대시보드 보기 권한)
router.get('/:id', fnRequireAnyPermission('my_dashboard.view'), fnGetInstance);

// POST /api/event-instances - 이벤트 생성 (instance.create 권한 필요)
router.post('/', fnRequireAnyPermission('instance.create'), fnCreateInstance);

// PUT /api/event-instances/:id - 이벤트 수정 (my_dashboard.edit) 또는 DBA 쿼리 수정(my_dashboard.query_edit)
router.put('/:id', fnRequireAnyPermission('my_dashboard.edit', 'my_dashboard.query_edit'), fnUpdateInstance);

// DELETE /api/event-instances/:id — 삭제(복원 불가). delete_instance 또는 레거시 delete 권한
router.delete(
  '/:id',
  fnRequireAnyPermission('my_dashboard.delete_instance', 'my_dashboard.delete'),
  fnDeleteInstance
);

// PATCH /api/event-instances/:id/status - 상태 변경
router.patch('/:id/status', fnUpdateStatus);

// POST /api/event-instances/:id/execute - QA/LIVE DB 쿼리 실행 (핵심)
// env별 단일 권한은 핸들러에서 검사 (qa → my_dashboard.execute_qa, live → my_dashboard.execute_live)
router.post('/:id/execute', fnExecuteAndDeploy);

export default router;
