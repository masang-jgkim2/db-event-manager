/**
 * F-02/F-03 E2E — 워크플로 인스턴스에 SELECT·DML 실행 이력 데모 INSERT (MySQL)
 * 사용: npm run seed-e2e-workflow:fresh && npm run seed-e2e-result-ui
 * 이후 백엔드 재기동(또는 run-e2e-with-servers.ps1)으로 인메모리 하이드레이트
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { RowDataPacket } from 'mysql2/promise';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';

const STR_TAG_SELECT = 'E2E_RESULT_UI_SELECT';
const STR_TAG_DML = 'E2E_RESULT_UI_DML';
const STR_CONFIG_PATH = resolve(
  process.env.E2E_WORKFLOW_CONFIG_PATH
    || resolve(process.cwd(), '../front/scripts/e2e-workflow-config.json'),
);

const fnToMysqlDatetime6 = (d: Date): string => {
  const p = (n: number, L: number) => String(n).padStart(L, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1, 2)}-${p(d.getDate(), 2)} ${p(d.getHours(), 2)}:${p(d.getMinutes(), 2)}:${p(d.getSeconds(), 2)}.${p(d.getMilliseconds(), 3)}000`;
};

const fnNextSort = async (pool: ReturnType<typeof fnGetMysqlAppPool>, nInstanceId: number): Promise<number> => {
  const [arrMax] = await pool.query<RowDataPacket[]>(
    'SELECT COALESCE(MAX(n_sort), -1) + 1 AS n_next FROM event_instance_status_log WHERE n_instance_id = ?',
    [nInstanceId],
  );
  return Number(arrMax[0]?.n_next ?? 0);
};

const fnInsertIfNew = async (
  pool: ReturnType<typeof fnGetMysqlAppPool>,
  nInstanceId: number,
  strTag: string,
  strStatus: string,
  objExec: object,
): Promise<boolean> => {
  const [arrDup] = await pool.query<RowDataPacket[]>(
    'SELECT n_id FROM event_instance_status_log WHERE n_instance_id = ? AND str_comment = ? LIMIT 1',
    [nInstanceId, strTag],
  );
  if (arrDup.length > 0) return false;
  const nSort = await fnNextSort(pool, nInstanceId);
  await pool.execute(
    `INSERT INTO event_instance_status_log (
      n_instance_id, n_sort, str_status, str_changed_by, n_changed_by_user_id, str_comment, dt_changed_at, json_execution_result
    ) VALUES (?,?,?,?,?,?,?,?)`,
    [nInstanceId, nSort, strStatus, 'E2E결과UI', 3, strTag, fnToMysqlDatetime6(new Date()), JSON.stringify(objExec)],
  );
  return true;
};

const fnMain = async (): Promise<void> => {
  if (!fnIsMysqlStore()) {
    console.error('[seed-result-ui] DATA_STORE=mysql 에서만 사용하세요.');
    process.exit(1);
  }
  if (!existsSync(STR_CONFIG_PATH)) {
    console.error('[seed-result-ui] 설정 없음 — npm run seed-e2e-workflow:fresh 먼저 실행');
    process.exit(1);
  }
  const objCfg = JSON.parse(readFileSync(STR_CONFIG_PATH, 'utf8')) as { nFreshInstanceId?: number };
  const nInstanceId = Number(process.env.E2E_INSTANCE_ID || objCfg.nFreshInstanceId || 0);
  if (!nInstanceId) {
    console.error('[seed-result-ui] nFreshInstanceId 없음');
    process.exit(1);
  }

  const pool = fnGetMysqlAppPool();
  const bSel = await fnInsertIfNew(pool, nInstanceId, STR_TAG_SELECT, 'qa_deployed', {
    strEnv: 'qa',
    bSuccess: true,
    nTotalAffectedRows: 3,
    nElapsedMs: 12,
    strConnectionSummary: 'E2E · SELECT demo',
    arrQueryResults: [
      {
        nIndex: 0,
        strQuery: 'SELECT 1 AS n UNION SELECT 2 UNION SELECT 3',
        nAffectedRows: 0,
        arrResultRows: [{ n: 1 }, { n: 2 }, { n: 3 }],
        arrResultColumns: ['n'],
        bResultTruncated: false,
      },
    ],
  });
  const bDml = await fnInsertIfNew(pool, nInstanceId, STR_TAG_DML, 'qa_deployed', {
    strEnv: 'qa',
    bSuccess: true,
    nTotalAffectedRows: 15,
    nElapsedMs: 8,
    strConnectionSummary: 'E2E · DML demo',
    arrQueryResults: [
      {
        nIndex: 0,
        strQuery: 'UPDATE e2e_demo SET x = 1 WHERE 1=0',
        nAffectedRows: 15,
      },
    ],
  });

  console.log(
    `[seed-result-ui] #${nInstanceId} | SELECT데모=${bSel ? 'INSERT' : 'skip'} DML데모=${bDml ? 'INSERT' : 'skip'}`,
  );

  const strApi = (process.env.E2E_API_BASE || 'http://localhost:4000/api').replace(/\/$/, '');
  const strKey = process.env.E2E_RELOAD_KEY || 'local-e2e';
  try {
    const res = await fetch(`${strApi}/e2e/reload-instances`, {
      method: 'POST',
      headers: { 'X-E2E-Reload-Key': strKey },
    });
    if (res.ok) {
      console.log('[seed-result-ui] 인메모리 재로드 완료 — npm run test:e2e:result-ui');
      return;
    }
  } catch {
    // 서버 미기동
  }
  console.log('[seed-result-ui] 백엔드 기동·E2E_ALLOW_RELOAD=1 후 시드를 다시 실행하거나 재기동하세요.');
};

fnMain().catch((err) => {
  console.error('[seed-result-ui] 실패', err);
  process.exit(1);
});
