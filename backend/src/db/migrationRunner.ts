import fs from 'fs';
import path from 'path';
import { fnGetSystemPool } from './systemDb';

// ──────────────────────────────────────────────────────────────────────────────
// 마이그레이션 러너
//
// migrations/ 폴더의 SQL 파일을 버전 순서대로 읽어
// DB의 _migrations 테이블에 없는 것만 자동 적용한다.
//
// 파일 명명 규칙: V{숫자}__{설명}.sql
//   예) V001__init_schema.sql
//       V002__add_product_table.sql
//       V003__add_event_instances.sql
//
// 새 스키마 변경이 필요할 때는 다음 번호의 파일을 추가하기만 하면 된다.
// 서버를 재시작하면 자동으로 적용된다.
// ──────────────────────────────────────────────────────────────────────────────

const STR_MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// 버전 번호 파싱 (V001__ → 1)
const fnParseVersion = (strFilename: string): number => {
  const match = strFilename.match(/^V(\d+)__/);
  return match ? parseInt(match[1], 10) : -1;
};

export const fnRunMigrations = async (): Promise<void> => {
  const pool = await fnGetSystemPool();

  // _migrations 테이블이 없으면 먼저 생성
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='_migrations' AND xtype='U')
    CREATE TABLE _migrations (
      n_version     INT           NOT NULL PRIMARY KEY,
      str_filename  NVARCHAR(255) NOT NULL,
      dt_applied_at DATETIME2     NOT NULL DEFAULT SYSDATETIME()
    )
  `);

  // 이미 적용된 버전 목록 조회
  const result = await pool.request().query(
    'SELECT n_version FROM _migrations ORDER BY n_version'
  );
  const setApplied = new Set<number>(result.recordset.map((r: any) => r.n_version));

  // migrations 폴더의 SQL 파일 목록을 버전 순으로 정렬
  if (!fs.existsSync(STR_MIGRATIONS_DIR)) {
    console.warn('[마이그레이션] migrations 폴더가 없습니다:', STR_MIGRATIONS_DIR);
    return;
  }

  const arrFiles = fs
    .readdirSync(STR_MIGRATIONS_DIR)
    .filter((f) => f.match(/^V\d+__.*\.sql$/))
    .sort((a, b) => fnParseVersion(a) - fnParseVersion(b));

  let nApplied = 0;

  for (const strFilename of arrFiles) {
    const nVersion = fnParseVersion(strFilename);
    if (nVersion === -1 || setApplied.has(nVersion)) continue;

    const strFilePath = path.join(STR_MIGRATIONS_DIR, strFilename);
    const strSql      = fs.readFileSync(strFilePath, 'utf-8');

    console.log(`[마이그레이션] V${String(nVersion).padStart(3, '0')} 적용 중: ${strFilename}`);

    try {
      // GO 구문 기준으로 배치 분리 후 순서대로 실행
      const arrBatches = strSql
        .split(/^\s*GO\s*$/im)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const strBatch of arrBatches) {
        await pool.request().query(strBatch);
      }

      // 적용 기록 저장
      await pool.request()
        .input('nVersion',    nVersion)
        .input('strFilename', strFilename)
        .query(`
          INSERT INTO _migrations (n_version, str_filename)
          VALUES (@nVersion, @strFilename)
        `);

      console.log(`[마이그레이션] V${String(nVersion).padStart(3, '0')} 적용 완료`);
      nApplied++;
    } catch (error: any) {
      console.error(`[마이그레이션] V${String(nVersion).padStart(3, '0')} 실패:`, error.message);
      throw new Error(`마이그레이션 실패 (${strFilename}): ${error.message}`);
    }
  }

  if (nApplied === 0) {
    console.log('[마이그레이션] 모든 마이그레이션이 최신 상태입니다.');
  } else {
    console.log(`[마이그레이션] ${nApplied}개 마이그레이션 적용 완료.`);
  }
};
