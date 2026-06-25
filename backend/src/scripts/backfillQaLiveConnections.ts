/**
 * 템플릿 세트·인스턴스 실행 대상 — nDbConnectionId → nQaDbConnectionId + nLiveDbConnectionId
 * 사용: cd backend && npm run backfill-qa-live-connections
 * 주의: LIVE 자동 매핑은 동일 DB명·kind·서비스 기준 — LH 게임 샤드 등은 실행 후 수동 검토
 */
import '../loadEnv';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { fnIsMysqlStore } from '../data/dataStore';
import { fnReadJsonArrayFromDiskRaw, fnMirrorJsonToDisk, fnSaveJson } from '../data/jsonStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnEnsureMysqlAppSchema } from '../db/mysqlAppDataAccess';
import { fnRelationalLoadDbConnections } from '../db/mysqlRelationalSync';
import type { IEventTemplate } from '../data/events';
import type { IEventInstance } from '../data/eventInstances';
import type { IDbConnection } from '../types';
import {
  fnFindLivePairForQaConnection,
  fnNormalizeExecutionTargetConnFields,
  fnNormalizeQueryTemplateConnFields,
} from '../utils/queryTemplateConnections';

const fnLoadConnections = async (pool: Pool | null): Promise<IDbConnection[]> => {
  if (fnIsMysqlStore() && pool) {
    await fnEnsureMysqlAppSchema(pool);
    return fnRelationalLoadDbConnections(pool);
  }
  return fnReadJsonArrayFromDiskRaw<IDbConnection>('db_connections.json') ?? [];
};

const fnBackfillTemplateSets = (
  arrEvents: IEventTemplate[],
  arrConns: IDbConnection[],
): { nTplSets: number; nMissingLive: number } => {
  let nTplSets = 0;
  let nMissingLive = 0;
  for (const objTpl of arrEvents) {
    if (!objTpl.arrQueryTemplates?.length) continue;
    for (const objSet of objTpl.arrQueryTemplates) {
      const objNorm = fnNormalizeQueryTemplateConnFields(objSet);
      const nQa = objNorm.nQaDbConnectionId;
      let nLive = objNorm.nLiveDbConnectionId;
      if (!nQa) continue;
      if (!nLive) {
        const objQa = arrConns.find((c) => c.nId === nQa);
        const objLive = objQa ? fnFindLivePairForQaConnection(arrConns, objQa) : undefined;
        if (objLive) {
          nLive = objLive.nId;
        } else {
          nMissingLive += 1;
          console.warn(
            `[backfill-qa-live] 템플릿 #${objTpl.nId} 세트 — LIVE 페어 없음 (QA #${nQa}, DB=${objQa?.strDatabase ?? '?'})`,
          );
        }
      }
      if (objSet.nQaDbConnectionId !== nQa || objSet.nLiveDbConnectionId !== nLive) {
        objSet.nQaDbConnectionId = nQa;
        objSet.nLiveDbConnectionId = nLive;
        nTplSets += 1;
      }
    }
  }
  return { nTplSets, nMissingLive };
};

const fnBackfillExecutionTargets = (
  arrInst: IEventInstance[],
  arrConns: IDbConnection[],
): { nTargets: number; nMissingLive: number } => {
  let nTargets = 0;
  let nMissingLive = 0;
  for (const objInst of arrInst) {
    if (!objInst.arrExecutionTargets?.length) continue;
    for (const objTarget of objInst.arrExecutionTargets) {
      const objNorm = fnNormalizeExecutionTargetConnFields(objTarget);
      const nQa = objNorm.nQaDbConnectionId;
      let nLive = objNorm.nLiveDbConnectionId;
      if (!nQa) continue;
      if (!nLive) {
        const objQa = arrConns.find((c) => c.nId === nQa);
        const objLive = objQa ? fnFindLivePairForQaConnection(arrConns, objQa) : undefined;
        if (objLive) {
          nLive = objLive.nId;
        } else {
          nMissingLive += 1;
          console.warn(
            `[backfill-qa-live] 인스턴스 #${objInst.nId} 세트 — LIVE 페어 없음 (QA #${nQa})`,
          );
        }
      }
      if (objTarget.nQaDbConnectionId !== nQa || objTarget.nLiveDbConnectionId !== nLive) {
        objTarget.nQaDbConnectionId = nQa;
        objTarget.nLiveDbConnectionId = nLive;
        nTargets += 1;
      }
    }
  }
  return { nTargets, nMissingLive };
};

const fnResolveDbConnId = (
  nProductId: number,
  nPreferred: number,
  arrDb: IDbConnection[],
): number => {
  if (nPreferred > 0 && arrDb.some((c) => c.nId === nPreferred && c.nProductId === nProductId)) {
    return nPreferred;
  }
  return 0;
};

const fnPersistQaLiveToMysql = async (
  pool: Pool,
  arrEvents: IEventTemplate[],
  arrInst: IEventInstance[],
  arrConns: IDbConnection[],
): Promise<void> => {
  const [arrTplRows] = await pool.query<RowDataPacket[]>('SELECT n_id FROM event_template');
  const setTplIds = new Set(arrTplRows.map((r) => Number(r.n_id)));
  const [arrInstRows] = await pool.query<RowDataPacket[]>('SELECT n_id FROM event_instance');
  const setInstIds = new Set(arrInstRows.map((r) => Number(r.n_id)));

  const conn: PoolConnection = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const objTpl of arrEvents) {
      if (!objTpl.arrQueryTemplates?.length || !setTplIds.has(objTpl.nId)) continue;
      await conn.execute('DELETE FROM event_template_query_set WHERE n_event_template_id = ?', [objTpl.nId]);
      let nSort = 0;
      for (const objSet of objTpl.arrQueryTemplates) {
        const objNorm = fnNormalizeQueryTemplateConnFields(objSet);
        const nQa = fnResolveDbConnId(objTpl.nProductId, objNorm.nQaDbConnectionId, arrConns);
        const nLive = fnResolveDbConnId(objTpl.nProductId, objNorm.nLiveDbConnectionId, arrConns);
        if (nQa <= 0 || nLive <= 0) {
          console.warn(
            `[backfill-qa-live] MySQL 스킵 — 템플릿 #${objTpl.nId} 세트 (QA=${objNorm.nQaDbConnectionId}, LIVE=${objNorm.nLiveDbConnectionId})`,
          );
          continue;
        }
        await conn.execute(
          `INSERT INTO event_template_query_set
            (n_event_template_id, n_sort, n_db_connection_id, n_live_db_connection_id, str_default_items, str_query_template)
           VALUES (?,?,?,?,?,?)`,
          [
            objTpl.nId,
            nSort,
            nQa,
            nLive,
            objSet.strDefaultItems ?? '',
            objSet.strQueryTemplate ?? '',
          ],
        );
        nSort += 1;
      }
    }
    for (const objInst of arrInst) {
      if (!objInst.arrExecutionTargets?.length || !setInstIds.has(objInst.nId)) continue;
      await conn.execute('DELETE FROM event_instance_execution_target WHERE n_instance_id = ?', [objInst.nId]);
      let nSort = 0;
      for (const objTarget of objInst.arrExecutionTargets) {
        const objNorm = fnNormalizeExecutionTargetConnFields(objTarget);
        const nQa = fnResolveDbConnId(objInst.nProductId, objNorm.nQaDbConnectionId, arrConns);
        const nLive = fnResolveDbConnId(objInst.nProductId, objNorm.nLiveDbConnectionId, arrConns);
        if (nQa <= 0 || nLive <= 0) {
          console.warn(
            `[backfill-qa-live] MySQL 스킵 — 인스턴스 #${objInst.nId} 세트 (QA=${objNorm.nQaDbConnectionId}, LIVE=${objNorm.nLiveDbConnectionId})`,
          );
          continue;
        }
        await conn.execute(
          `INSERT INTO event_instance_execution_target
            (n_instance_id, n_sort, n_db_connection_id, n_live_db_connection_id, str_query)
           VALUES (?,?,?,?,?)`,
          [objInst.nId, nSort, nQa, nLive, objTarget.strQuery ?? ''],
        );
        nSort += 1;
      }
    }
    await conn.commit();
    console.log('[backfill-qa-live] MySQL QA/LIVE 컬럼 반영 완료');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const fnMain = async () => {
  const pool = fnIsMysqlStore() ? await fnGetMysqlAppPool() : null;
  const arrConns = await fnLoadConnections(pool);

  const arrEvents = fnReadJsonArrayFromDiskRaw<IEventTemplate>('events.json') ?? [];
  const arrInst = fnReadJsonArrayFromDiskRaw<IEventInstance>('eventInstances.json') ?? [];

  const objTpl = fnBackfillTemplateSets(arrEvents, arrConns);
  const objInst = fnBackfillExecutionTargets(arrInst, arrConns);

  console.log(
    `[backfill-qa-live] 템플릿 세트 ${objTpl.nTplSets}건, 실행 대상 ${objInst.nTargets}건 갱신` +
    ` | LIVE 미매핑: 템플릿 ${objTpl.nMissingLive}, 인스턴스 ${objInst.nMissingLive}`,
  );

  if (fnIsMysqlStore() && pool) {
    await fnPersistQaLiveToMysql(pool, arrEvents, arrInst, arrConns);
  }

  fnMirrorJsonToDisk('events.json', arrEvents);
  fnMirrorJsonToDisk('eventInstances.json', arrInst);
  if (!fnIsMysqlStore()) {
    fnSaveJson('events.json', arrEvents);
    fnSaveJson('eventInstances.json', arrInst);
  }
  console.log('[backfill-qa-live] JSON 미러 저장 완료');
  console.log('[backfill-qa-live] 실행 중 백엔드가 있으면 재시작하세요.');
};

fnMain().catch((err) => {
  console.error('[backfill-qa-live] 실패', err);
  process.exit(1);
});
