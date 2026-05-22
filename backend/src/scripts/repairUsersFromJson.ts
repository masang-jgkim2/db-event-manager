/**
 * users.json·userRoles.json → 인메모리·MySQL 동기화 (비밀번호 불일치 복구).
 * 사용: npm run repair-users-from-json  (backend 폴더, .env DATA_STORE=mysql)
 */
import 'dotenv/config';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnRehydrateUsersFromJsonDisk } from '../data/users';

const fnMain = async (): Promise<void> => {
  if (!fnIsMysqlStore()) {
    console.log('[repair-users] DATA_STORE=json — users.json 이 이미 기준이므로 생략');
    return;
  }
  const n = await fnRehydrateUsersFromJsonDisk();
  console.log(`[repair-users] 완료 | ${n}명 반영. 백엔드를 재시작한 뒤 로그인하세요.`);
};

void fnMain().catch((err: unknown) => {
  console.error('[repair-users] 실패 |', (err as Error)?.message);
  process.exit(1);
});
