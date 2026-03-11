import bcrypt from 'bcryptjs';
import { fnGetSystemPool } from './systemDb';

// 마이그레이션 이후 실행: bcrypt 해시가 필요한 시드 데이터 삽입
// (SQL 파일에는 bcrypt 해시를 넣을 수 없으므로 여기서 처리)
export const fnInsertSeedUsers = async (): Promise<void> => {
  try {
    const pool = await fnGetSystemPool();

    const arrUserSeeds = [
      { strUserId: 'admin', strPassword: await bcrypt.hash('admin123', 10), strDisplayName: '관리자',     arrRoles: ['admin'] },
      { strUserId: 'gm01',  strPassword: await bcrypt.hash('gm123',    10), strDisplayName: 'GM_홍길동',  arrRoles: ['game_manager'] },
      { strUserId: 'dba01', strPassword: await bcrypt.hash('dba123',   10), strDisplayName: 'DBA_김철수', arrRoles: ['dba'] },
    ];

    for (const u of arrUserSeeds) {
      await pool.request()
        .input('strUserId',      u.strUserId)
        .input('strPassword',    u.strPassword)
        .input('strDisplayName', u.strDisplayName)
        .input('arrRoles',       JSON.stringify(u.arrRoles))
        .query(`
          IF NOT EXISTS (SELECT 1 FROM users WHERE str_user_id = @strUserId)
          INSERT INTO users (str_user_id, str_password, str_display_name, arr_roles)
          VALUES (@strUserId, @strPassword, @strDisplayName, @arrRoles)
        `);
    }
  } catch (error: any) {
    console.error('[시드] 기본 사용자 삽입 실패:', error.message);
  }
};
