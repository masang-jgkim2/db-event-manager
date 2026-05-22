import { fnIsMysqlStore } from '../data/dataStore';
import {
  arrEventInstances,
  fnSaveEventInstances,
  type IEventInstance,
  type IStageActor,
} from '../data/eventInstances';
import { arrUsers } from '../data/users';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import {
  fnAwaitInFlightMysqlDocFlush,
  fnCancelAllPendingMysqlDocFlush,
  fnCancelMysqlDocFlushForFiles,
} from '../db/mysqlDocPersist';

type TActorFieldKey =
  | 'objCreator'
  | 'objConfirmer'
  | 'objQaRequester'
  | 'objQaDeployer'
  | 'objQaVerifier'
  | 'objLiveRequester'
  | 'objLiveDeployer'
  | 'objLiveVerifier';

const ARR_ACTOR_FIELD_KEYS: TActorFieldKey[] = [
  'objCreator',
  'objConfirmer',
  'objQaRequester',
  'objQaDeployer',
  'objQaVerifier',
  'objLiveRequester',
  'objLiveDeployer',
  'objLiveVerifier',
];

const fnSetStageActor = (
  objInst: IEventInstance,
  strKey: TActorFieldKey,
  objActor: IStageActor,
): void => {
  switch (strKey) {
    case 'objCreator':
      objInst.objCreator = objActor;
      break;
    case 'objConfirmer':
      objInst.objConfirmer = objActor;
      break;
    case 'objQaRequester':
      objInst.objQaRequester = objActor;
      break;
    case 'objQaDeployer':
      objInst.objQaDeployer = objActor;
      break;
    case 'objQaVerifier':
      objInst.objQaVerifier = objActor;
      break;
    case 'objLiveRequester':
      objInst.objLiveRequester = objActor;
      break;
    case 'objLiveDeployer':
      objInst.objLiveDeployer = objActor;
      break;
    case 'objLiveVerifier':
      objInst.objLiveVerifier = objActor;
      break;
    default:
      break;
  }
};

/** MySQL event_instance·stage_actor·status_log 만 갱신 (전체 메타 치환·서버 다운 방지) */
const fnSyncEventInstanceUserReassignToMysql = async (
  nFromUserId: number,
  rowTo: { nId: number; strUserId: string; strDisplayName: string },
): Promise<void> => {
  const pool = fnGetMysqlAppPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE event_instance
       SET n_created_by_user_id = ?, str_created_by = ?
       WHERE n_created_by_user_id = ?`,
      [rowTo.nId, rowTo.strDisplayName, nFromUserId],
    );
    await conn.execute(
      `UPDATE event_instance_stage_actor
       SET n_user_id = ?, str_user_id = ?, str_display_name = ?
       WHERE n_user_id = ?`,
      [rowTo.nId, rowTo.strUserId, rowTo.strDisplayName, nFromUserId],
    );
    await conn.execute(
      `UPDATE event_instance_status_log
       SET n_changed_by_user_id = ?, str_changed_by = ?
       WHERE n_changed_by_user_id = ?`,
      [rowTo.nId, rowTo.strDisplayName, nFromUserId],
    );
    await conn.commit();
  } catch (err: unknown) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** 삭제 사용자의 이벤트 인스턴스·로그 참조를 다른 계정으로 이관 */
export const fnReassignUserReferencesInEventInstances = async (
  nFromUserId: number,
  nToUserId: number,
): Promise<{ nCreatedInstances: number; nStageActorRows: number; nStatusLogRows: number }> => {
  const rowTo = arrUsers.find((u) => u.nId === nToUserId);
  if (!rowTo) {
    throw new Error('이관 대상 사용자를 찾을 수 없습니다.');
  }

  const fnToActor = (objOld: IStageActor): IStageActor => ({
    nUserId: rowTo.nId,
    strUserId: rowTo.strUserId,
    strDisplayName: rowTo.strDisplayName,
    dtProcessedAt: objOld.dtProcessedAt,
  });

  let nCreatedInstances = 0;
  let nStageActorRows = 0;
  let nStatusLogRows = 0;

  for (const objInst of arrEventInstances) {
    if (objInst.nCreatedByUserId === nFromUserId) {
      objInst.nCreatedByUserId = nToUserId;
      objInst.strCreatedBy = rowTo.strDisplayName;
      nCreatedInstances += 1;
    }
    for (const strKey of ARR_ACTOR_FIELD_KEYS) {
      const objActor = objInst[strKey] as IStageActor | null | undefined;
      if (objActor?.nUserId === nFromUserId) {
        fnSetStageActor(objInst, strKey, fnToActor(objActor));
        nStageActorRows += 1;
      }
    }
    for (const objLog of objInst.arrStatusLogs) {
      if (objLog.nChangedByUserId === nFromUserId) {
        objLog.nChangedByUserId = nToUserId;
        objLog.strChangedBy = rowTo.strDisplayName;
        nStatusLogRows += 1;
      }
    }
  }

  if (nCreatedInstances > 0 || nStageActorRows > 0 || nStatusLogRows > 0) {
    if (fnIsMysqlStore()) {
      await fnAwaitInFlightMysqlDocFlush();
      fnCancelAllPendingMysqlDocFlush();
      fnCancelMysqlDocFlushForFiles(['eventInstances.json']);
      await fnSyncEventInstanceUserReassignToMysql(nFromUserId, rowTo);
    } else {
      fnSaveEventInstances();
    }
    console.log(
      `[사용자 이관] nFrom=${nFromUserId} → nTo=${nToUserId}(${rowTo.strUserId}) | ` +
        `생성=${nCreatedInstances} stage=${nStageActorRows} log=${nStatusLogRows}`,
    );
  }

  return { nCreatedInstances, nStageActorRows, nStatusLogRows };
};
