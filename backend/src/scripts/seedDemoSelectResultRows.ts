/**
 * UI 데모용 — #118(기본)에 SELECT 결과셋 이력 1건 INSERT (전체 DB replace 없음)
 * 사용: npm run seed-demo-select-rows → 백엔드 tsx watch 재기동 후 probe
 */
import 'dotenv/config';
import type { RowDataPacket } from 'mysql2/promise';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';

const N_INSTANCE_ID = Number(process.env.DEMO_INSTANCE_ID || 118);
const STR_DEMO_TAG = 'E2E데모_SELECT결과셋';

const fnToMysqlDatetime6 = (d: Date): string => {
  const p = (n: number, L: number) => String(n).padStart(L, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1, 2)}-${p(d.getDate(), 2)} ${p(d.getHours(), 2)}:${p(d.getMinutes(), 2)}:${p(d.getSeconds(), 2)}.${p(d.getMilliseconds(), 3)}000`;
};

const fnMain = async (): Promise<void> => {
  if (!fnIsMysqlStore()) {
    console.error('[seed-demo] DATA_STORE=mysql 에서만 사용하세요.');
    process.exit(1);
  }
  const pool = fnGetMysqlAppPool();
  const [arrDup] = await pool.query<RowDataPacket[]>(
    'SELECT n_id FROM event_instance_status_log WHERE n_instance_id = ? AND str_comment = ? LIMIT 1',
    [N_INSTANCE_ID, STR_DEMO_TAG],
  );
  if (arrDup.length > 0) {
    console.log(`[seed-demo] #${N_INSTANCE_ID} 데모 이력 이미 있음 — 스킵`);
    return;
  }
  const [arrMax] = await pool.query<RowDataPacket[]>(
    'SELECT COALESCE(MAX(n_sort), -1) + 1 AS n_next FROM event_instance_status_log WHERE n_instance_id = ?',
    [N_INSTANCE_ID],
  );
  const nSort = Number(arrMax[0]?.n_next ?? 0);
  const objExec = {
    strEnv: 'qa',
    bSuccess: true,
    nTotalAffectedRows: 1,
    nElapsedMs: 15,
    strConnectionSummary: 'demo · SELECT 1',
    arrQueryResults: [
      {
        nIndex: 0,
        strQuery: 'SELECT 1 AS n',
        nAffectedRows: 0,
        arrResultRows: [{ n: 1 }],
        arrResultColumns: ['n'],
        bResultTruncated: false,
      },
    ],
  };
  await pool.execute(
    `INSERT INTO event_instance_status_log (
      n_instance_id, n_sort, str_status, str_changed_by, n_changed_by_user_id, str_comment, dt_changed_at, json_execution_result
    ) VALUES (?,?,?,?,?,?,?,?)`,
    [
      N_INSTANCE_ID,
      nSort,
      'qa_deployed',
      'E2E데모',
      3,
      STR_DEMO_TAG,
      fnToMysqlDatetime6(new Date()),
      JSON.stringify(objExec),
    ],
  );
  console.log(`[seed-demo] #${N_INSTANCE_ID} status_log INSERT (n_sort=${nSort})`);
  console.log('[seed-demo] 백엔드 dev(tsx watch)가 재기동되면 probe 실행하세요.');
};

fnMain().catch((err) => {
  console.error('[seed-demo] 실패', err);
  process.exit(1);
});
