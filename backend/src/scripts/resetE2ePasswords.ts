/**
 * E2E smoke용 계정 비밀번호 동기화 (MySQL·JSON)
 * 사용: npm run reset-e2e-passwords (backend 디렉터리)
 */
import 'dotenv/config';
import { fnResetPasswordByUserId } from '../data/users';

const arrTargets: { strUserId: string; strPassword: string }[] = [
  { strUserId: 'admin', strPassword: 'admin123' },
  { strUserId: 'dba01', strPassword: process.env.E2E_DBA_PASSWORD || 'dba01' },
  { strUserId: 'gm01', strPassword: process.env.E2E_GM_PASSWORD || 'gm01' },
  { strUserId: 'gm02', strPassword: process.env.E2E_GM2_PASSWORD || process.env.E2E_GM02_PASSWORD || 'gm02' },
];

const fnMain = async (): Promise<void> => {
  for (const { strUserId, strPassword } of arrTargets) {
    const bDone = await fnResetPasswordByUserId(strUserId, strPassword);
    if (!bDone) {
      console.error(`[reset-e2e] 사용자 없음: ${strUserId}`);
      process.exit(1);
    }
    console.log(`[reset-e2e] ${strUserId} → OK`);
  }
};

fnMain().catch((err) => {
  console.error('[reset-e2e] 실패', err);
  process.exit(1);
});
