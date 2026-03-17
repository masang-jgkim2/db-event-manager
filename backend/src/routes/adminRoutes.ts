import { Router, Request, Response } from 'express';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission } from '../middleware/permissionMiddleware';
import { fnSaveSeedTest } from '../data/seedTest';
import { fnResetPasswordByUserId } from '../data/users';

const router = Router();

// 외부(IP) 접속 시 로그인 안 될 때, 해당 서버의 admin 비밀번호를 admin123으로 한 번 초기화
// 사용: ALLOW_INIT_ADMIN=true, INIT_ADMIN_SECRET=원하는비밀키 설정 후 POST { "secret": "원하는비밀키" } → 완료 후 env 해제·재시작
router.post('/init-admin-password', async (req: Request, res: Response) => {
  const bAllow = process.env.ALLOW_INIT_ADMIN === 'true';
  const strSecret = process.env.INIT_ADMIN_SECRET || '';
  const strBodySecret = req.body?.secret;
  if (!bAllow || !strSecret || strBodySecret !== strSecret) {
    res.status(403).json({ bSuccess: false, strMessage: '비활성화되었거나 시크릿이 일치하지 않습니다.' });
    return;
  }
  const bDone = await fnResetPasswordByUserId('admin', 'admin123');
  if (!bDone) {
    res.status(500).json({ bSuccess: false, strMessage: 'admin 사용자를 찾을 수 없습니다.' });
    return;
  }
  console.log('[admin] init-admin-password 실행됨 — admin 비밀번호가 admin123으로 초기화되었습니다.');
  res.json({ bSuccess: true, strMessage: 'admin 비밀번호가 admin123으로 초기화되었습니다. 로그인 후 ALLOW_INIT_ADMIN을 해제하고 서버를 재시작하세요.' });
});

// 현재 메모리 데이터를 테스트 초기화 데이터(seed_test.json)로 저장 — system.save_test_seed 권한 필요
router.post('/save-test-seed', fnAuthMiddleware, fnRequireAnyPermission('system.save_test_seed'), (_req: Request, res: Response) => {
  try {
    fnSaveSeedTest();
    res.json({ bSuccess: true, strMessage: '테스트 초기화 데이터가 저장되었습니다. 서버 재시작 시 이 데이터가 로드됩니다.' });
  } catch (error) {
    console.error('테스트 초기화 데이터 저장 오류:', error);
    res.status(500).json({ bSuccess: false, strMessage: '저장에 실패했습니다.' });
  }
});

export default router;
