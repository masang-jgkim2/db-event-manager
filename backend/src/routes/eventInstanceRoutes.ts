import { Router, Request, Response } from 'express';
import {
  fnCreateInstance, fnGetInstances,
  fnUpdateStatus, fnGetInstance, fnUpdateInstance,
  fnExecuteAndDeploy,
} from '../controllers/eventInstanceController';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission } from '../middleware/permissionMiddleware';
import {
  fnRegisterClient, fnUnregisterClient, fnGetClientCount,
} from '../services/sseBroadcaster';

const router = Router();

// ──────────────────────────────────────────────────────────
// SSE 스트림 연결 - 인증 필요 (라우터 use 보다 먼저 선언)
// GET /api/event-instances/stream
// ──────────────────────────────────────────────────────────
router.get('/stream', fnAuthMiddleware, (req: Request, res: Response) => {
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
// instance.execute_qa/live 또는 세분화 권한(my_dashboard.execute_qa/live) 허용
router.post(
  '/:id/execute',
  fnRequireAnyPermission(
    'instance.execute_qa', 'instance.execute_live',
    'my_dashboard.execute_qa', 'my_dashboard.execute_live'
  ),
  fnExecuteAndDeploy
);

export default router;
