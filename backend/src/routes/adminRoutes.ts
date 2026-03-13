import { Router, Request, Response } from 'express';
import { fnAuthMiddleware } from '../middleware/authMiddleware';
import { fnRequireAnyPermission } from '../middleware/permissionMiddleware';
import { fnSaveSeedTest } from '../data/seedTest';

const router = Router();

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
