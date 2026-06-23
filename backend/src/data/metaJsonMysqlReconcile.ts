/**
 * DATA_STORE=mysql — 디스크 JSON 미러 vs MySQL(인메모리) 불일치 시 최신 쪽으로 병합.
 * 미러만 앞서간 경우(비동기 flush 유실) 기동 시 자동 복구.
 */
import type { Pool } from 'mysql2/promise';
import type { IEventInstance } from './eventInstances';
import type { IEventTemplate } from './events';
import type { IProduct } from './products';
import type { IDbConnection } from '../types';
import type { IUserRow } from './users';
import { fnReadJsonArrayFromDiskRaw, fnMirrorJsonToDisk } from './jsonStore';
import { fnIsMysqlStore } from './dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnRelationalWriteFullFromMemory } from '../db/mysqlRelationalSync';
import { fnNormalizeConnections } from './dbConnections';
import { fnMigrateToQuerySetsWithConnections } from './events';
import type { IRoleRowJson } from '../db/mysqlRelationalSync';

const B_SKIP_RECONCILE =
  process.env.DATA_MYSQL_SKIP_JSON_RECONCILE === '1'
  || process.env.DATA_MYSQL_SKIP_JSON_RECONCILE === 'true';

const fnParseMs = (str?: string | null): number => {
  if (!str) return 0;
  const n = Date.parse(str);
  return Number.isNaN(n) ? 0 : n;
};

/** 인스턴스 — 생성·상태 이력·영구삭제 시각 중 최신 */
export const fnEventInstanceRevisionMs = (obj: IEventInstance): number => {
  let n = fnParseMs(obj.dtCreatedAt);
  n = Math.max(n, fnParseMs(obj.dtPermanentlyRemovedAt));
  for (const objLog of obj.arrStatusLogs ?? []) {
    n = Math.max(n, fnParseMs(objLog.dtChangedAt));
  }
  return n;
};

export const fnDbConnectionRevisionMs = (obj: IDbConnection): number =>
  Math.max(fnParseMs(obj.dtUpdatedAt), fnParseMs(obj.dtCreatedAt));

export interface IMergeByNIdStats {
  nMysql: number;
  nJson: number;
  nMerged: number;
  arrJsonOnly: number[];
  arrMysqlOnly: number[];
  arrJsonWon: number[];
  arrMysqlWon: number[];
  bChanged: boolean;
}

/** nId 기준 병합 — 동일 ID는 revision 큰 쪽, 동률이면 MySQL 우선 */
export const fnMergeByNId = <T extends { nId: number }>(
  arrMysql: readonly T[],
  arrJson: readonly T[],
  fnRevision: (row: T) => number,
): { arrMerged: T[]; stats: IMergeByNIdStats } => {
  const mapMysql = new Map(arrMysql.map((row) => [row.nId, row]));
  const mapJson = new Map(arrJson.map((row) => [row.nId, row]));
  const arrIds = [...new Set([...mapMysql.keys(), ...mapJson.keys()])].sort((a, b) => a - b);

  const arrJsonOnly: number[] = [];
  const arrMysqlOnly: number[] = [];
  const arrJsonWon: number[] = [];
  const arrMysqlWon: number[] = [];
  const arrMerged: T[] = [];
  let bChanged = arrMysql.length !== arrJson.length;

  for (const nId of arrIds) {
    const rowMysql = mapMysql.get(nId);
    const rowJson = mapJson.get(nId);
    if (rowMysql && rowJson) {
      const nMysqlRev = fnRevision(rowMysql);
      const nJsonRev = fnRevision(rowJson);
      const rowPick = nJsonRev > nMysqlRev ? rowJson : rowMysql;
      if (rowPick !== rowMysql) {
        bChanged = true;
        arrJsonWon.push(nId);
      } else if (nJsonRev < nMysqlRev) {
        arrMysqlWon.push(nId);
      }
      arrMerged.push(rowPick);
    } else if (rowJson) {
      arrMerged.push(rowJson);
      arrJsonOnly.push(nId);
      bChanged = true;
    } else if (rowMysql) {
      arrMerged.push(rowMysql);
      arrMysqlOnly.push(nId);
    }
  }

  if (!bChanged && arrMerged.length === arrMysql.length) {
    for (let i = 0; i < arrMerged.length; i += 1) {
      if (arrMerged[i] !== arrMysql[i]) {
        bChanged = true;
        break;
      }
    }
  }

  return {
    arrMerged,
    stats: {
      nMysql: arrMysql.length,
      nJson: arrJson.length,
      nMerged: arrMerged.length,
      arrJsonOnly,
      arrMysqlOnly,
      arrJsonWon,
      arrMysqlWon,
      bChanged,
    },
  };
};

const fnLogMergeStats = (strLabel: string, stats: IMergeByNIdStats): void => {
  if (!stats.bChanged) {
    console.log(`[DataStore] JSON↔MySQL 동기화 | ${strLabel} | 일치 (${stats.nMerged}건)`);
    return;
  }
  const arrParts: string[] = [];
  if (stats.arrJsonOnly.length) arrParts.push(`json만=${stats.arrJsonOnly.join(',')}`);
  if (stats.arrJsonWon.length) arrParts.push(`json최신=${stats.arrJsonWon.join(',')}`);
  if (stats.arrMysqlWon.length) arrParts.push(`mysql최신=${stats.arrMysqlWon.join(',')}`);
  console.log(
    `[DataStore] JSON↔MySQL 동기화 | ${strLabel} | 병합 ${stats.nMysql}→${stats.nMerged}건 | ${arrParts.join(' ')}`,
  );
};

export interface IMetaReconcileSummary {
  bAnyChanged: boolean;
  arrDetails: Array<{ strEntity: string; stats: IMergeByNIdStats }>;
}

/** 기동·CLI — 미러 JSON이 MySQL보다 최신이면 메모리 병합 후 MySQL·미러에 반영 */
export const fnReconcileMetaJsonWithMysql = async (
  pool?: Pool,
): Promise<IMetaReconcileSummary> => {
  if (!fnIsMysqlStore() || B_SKIP_RECONCILE) {
    return { bAnyChanged: false, arrDetails: [] };
  }

  const objPool = pool ?? fnGetMysqlAppPool();
  const { arrEventInstances } = await import('./eventInstances');
  const { arrEvents } = await import('./events');
  const { arrProducts } = await import('./products');
  const { arrDbConnections } = await import('./dbConnections');
  const { arrUsers } = await import('./users');
  const { arrUserRoles } = await import('./userRoles');
  const { arrRoles } = await import('./roles');

  const arrDetails: IMetaReconcileSummary['arrDetails'] = [];
  const setMirrorFiles = new Set<string>();
  let bAnyChanged = false;

  const arrJsonInst = fnReadJsonArrayFromDiskRaw<IEventInstance>('eventInstances.json') ?? [];
  if (arrJsonInst.length > 0) {
    const { arrMerged, stats } = fnMergeByNId(
      arrEventInstances,
      arrJsonInst,
      fnEventInstanceRevisionMs,
    );
    arrDetails.push({ strEntity: 'eventInstances', stats });
    if (stats.bChanged) {
      arrEventInstances.length = 0;
      arrEventInstances.push(...arrMerged);
      setMirrorFiles.add('eventInstances.json');
      bAnyChanged = true;
    }
    fnLogMergeStats('eventInstances', stats);
  }

  const arrJsonEvents = fnReadJsonArrayFromDiskRaw<IEventTemplate>('events.json') ?? [];
  if (arrJsonEvents.length > 0) {
    const arrJsonNorm = fnMigrateToQuerySetsWithConnections(arrJsonEvents, arrDbConnections);
    const { arrMerged, stats } = fnMergeByNId(arrEvents, arrJsonNorm, (e) => fnParseMs(e.dtCreatedAt));
    arrDetails.push({ strEntity: 'events', stats });
    if (stats.bChanged) {
      arrEvents.length = 0;
      arrEvents.push(...arrMerged);
      setMirrorFiles.add('events.json');
      bAnyChanged = true;
    }
    fnLogMergeStats('events', stats);
  }

  const arrJsonProducts = fnReadJsonArrayFromDiskRaw<IProduct>('products.json') ?? [];
  if (arrJsonProducts.length > 0) {
    const { arrMerged, stats } = fnMergeByNId(
      arrProducts,
      arrJsonProducts,
      (p) => fnParseMs(p.dtCreatedAt),
    );
    arrDetails.push({ strEntity: 'products', stats });
    if (stats.bChanged) {
      arrProducts.length = 0;
      arrProducts.push(...arrMerged);
      setMirrorFiles.add('products.json');
      bAnyChanged = true;
    }
    fnLogMergeStats('products', stats);
  }

  const arrJsonDb = fnReadJsonArrayFromDiskRaw<IDbConnection>('dbConnections.json') ?? [];
  if (arrJsonDb.length > 0) {
    const arrJsonNorm = fnNormalizeConnections(arrJsonDb);
    const { arrMerged, stats } = fnMergeByNId(
      arrDbConnections,
      arrJsonNorm,
      fnDbConnectionRevisionMs,
    );
    arrDetails.push({ strEntity: 'dbConnections', stats });
    if (stats.bChanged) {
      arrDbConnections.length = 0;
      arrDbConnections.push(...arrMerged);
      setMirrorFiles.add('dbConnections.json');
      bAnyChanged = true;
    }
    fnLogMergeStats('dbConnections', stats);
  }

  // roles — JSON에만 있는 역할(예: E2E 프로브) 병합 후 user_roles FK 보장
  const arrJsonRoles = fnReadJsonArrayFromDiskRaw<IRoleRowJson>('roles.json') ?? [];
  if (arrJsonRoles.length > 0) {
    const { arrMerged, stats } = fnMergeByNId(
      arrRoles,
      arrJsonRoles,
      (r) => Math.max(fnParseMs(r.dtUpdatedAt), fnParseMs(r.dtCreatedAt)),
    );
    arrDetails.push({ strEntity: 'roles', stats });
    if (stats.bChanged) {
      arrRoles.length = 0;
      arrRoles.push(...arrMerged);
      setMirrorFiles.add('roles.json');
      bAnyChanged = true;
    }
    fnLogMergeStats('roles', stats);
  }

  // users — JSON에만 있는 nId만 추가(기존 행 덮어쓰지 않음)
  const arrJsonUsers = fnReadJsonArrayFromDiskRaw<IUserRow>('users.json') ?? [];
  if (arrJsonUsers.length > 0) {
    const setMysqlIds = new Set(arrUsers.map((u) => u.nId));
    const arrOnlyJson = arrJsonUsers.filter((u) => !setMysqlIds.has(u.nId));
    if (arrOnlyJson.length > 0) {
      arrUsers.push(...arrOnlyJson);
      setMirrorFiles.add('users.json');
      bAnyChanged = true;
      console.log(
        `[DataStore] JSON↔MySQL 동기화 | users | json만 추가 ${arrOnlyJson.map((u) => u.nId).join(',')}`,
      );
    }
  }

  const arrJsonUr = fnReadJsonArrayFromDiskRaw<{ nUserId: number; nRoleId: number }>(
    'userRoles.json',
  ) ?? [];
  if (arrJsonUr.length > 0) {
    const setRoleIds = new Set(arrRoles.map((r) => r.nId));
    const setUserIds = new Set(arrUsers.map((u) => u.nId));
    const setKey = new Set(arrUserRoles.map((ur) => `${ur.nUserId}:${ur.nRoleId}`));
    let nAdded = 0;
    for (const ur of arrJsonUr) {
      const strKey = `${ur.nUserId}:${ur.nRoleId}`;
      if (setKey.has(strKey)) continue;
      if (!setUserIds.has(ur.nUserId) || !setRoleIds.has(ur.nRoleId)) {
        console.warn(
          `[DataStore] JSON↔MySQL 동기화 | userRoles | FK 미충족 스킵 | user=${ur.nUserId} role=${ur.nRoleId}`,
        );
        continue;
      }
      arrUserRoles.push(ur);
      setKey.add(strKey);
      nAdded += 1;
    }
    if (nAdded > 0) {
      setMirrorFiles.add('userRoles.json');
      bAnyChanged = true;
      console.log(`[DataStore] JSON↔MySQL 동기화 | userRoles | json만 ${nAdded}건 추가`);
    }
  }

  if (!bAnyChanged) {
    return { bAnyChanged: false, arrDetails };
  }

  const { fnEnsureEventTemplatesForInstances, fnSaveEvents } = await import('./events');
  if (fnEnsureEventTemplatesForInstances(arrEvents, arrEventInstances) > 0) {
    fnSaveEvents();
    setMirrorFiles.add('events.json');
  }

  await fnRelationalWriteFullFromMemory(objPool);

  if (setMirrorFiles.has('eventInstances.json')) {
    fnMirrorJsonToDisk('eventInstances.json', arrEventInstances);
  }
  if (setMirrorFiles.has('events.json')) {
    fnMirrorJsonToDisk('events.json', arrEvents);
  }
  if (setMirrorFiles.has('products.json')) {
    fnMirrorJsonToDisk('products.json', arrProducts);
  }
  if (setMirrorFiles.has('dbConnections.json')) {
    const arrForDisk = arrDbConnections.map((c) => ({ ...c }));
    fnMirrorJsonToDisk('dbConnections.json', arrForDisk);
  }
  if (setMirrorFiles.has('users.json')) {
    fnMirrorJsonToDisk('users.json', arrUsers);
    fnMirrorJsonToDisk('userRoles.json', arrUserRoles);
  }
  if (setMirrorFiles.has('roles.json')) {
    fnMirrorJsonToDisk('roles.json', arrRoles);
  }

  console.log('[DataStore] JSON↔MySQL 동기화 완료 | MySQL·미러 반영');
  return { bAnyChanged: true, arrDetails };
};
