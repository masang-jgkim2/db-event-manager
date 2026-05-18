// 사용자 — 정규화: 역할은 userRoles.ts에서 조회/저장
import bcrypt from 'bcryptjs';
import { IUser } from '../types';
import {
  fnLoadJson,
  fnMirrorJsonToDisk,
  fnReadJsonArrayFromDiskRaw,
  fnSaveJson,
} from './jsonStore';
import { fnIsMysqlStore } from './dataStore';
import type { RowDataPacket } from 'mysql2/promise';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnRelationalLoadUserRoles, fnRelationalLoadUsers } from '../db/mysqlRelationalSync';
import { fnAwaitInFlightMysqlDocFlush, fnCancelAllPendingMysqlDocFlush } from '../db/mysqlDocPersist';

const fnToMysqlDatetime6 = (v: string | Date): string => {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '1970-01-01 00:00:00.000000';
  const p = (n: number, L: number) => String(n).padStart(L, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1, 2)}-${p(d.getDate(), 2)} ${p(d.getHours(), 2)}:${p(d.getMinutes(), 2)}:${p(d.getSeconds(), 2)}.${p(d.getMilliseconds(), 3)}000`;
};
import { arrUserRoles, STR_USER_ROLES_FILE } from './userRoles';
import { arrRoles, fnGetRoleIdsByRoleCodes } from './roles';
import { fnGetRoleIdsByUserId, fnSaveUserRoles, fnSetRolesForUser } from './userRoles';

/** 저장용 사용자 행 (arrRoles 없음) */
interface IUserRow {
  nId: number;
  strUserId: string;
  strPassword: string;
  strDisplayName: string;
  dtCreatedAt: string;
}

const STR_FILE = 'users.json';

const ARR_SEED: IUserRow[] = [
  { nId: 1, strUserId: 'admin', strPassword: '__PENDING__', strDisplayName: '관리자', dtCreatedAt: new Date().toISOString() },
  { nId: 2, strUserId: 'gm01', strPassword: '__PENDING__', strDisplayName: 'GM_홍길동', dtCreatedAt: new Date().toISOString() },
  { nId: 3, strUserId: 'dba01', strPassword: '__PENDING__', strDisplayName: 'DBA_김철수', dtCreatedAt: new Date().toISOString() },
  { nId: 4, strUserId: 'planner01', strPassword: '__PENDING__', strDisplayName: '기획자_이영희', dtCreatedAt: new Date().toISOString() },
];

export const arrUsers: IUserRow[] = fnLoadJson<IUserRow>(STR_FILE, ARR_SEED);

/** mysql 모드는 fnCommitUserDataStore 가 반영 — 전체 메타 치환 예약 금지 */
export const fnSaveUsers = () => {
  if (fnIsMysqlStore()) return;
  fnSaveJson(STR_FILE, arrUsers);
};

/** 삭제 불가 사유(없으면 null) — 이벤트 인스턴스·단계 처리자 FK */
export const fnGetUserDeleteBlockReason = async (nUserId: number): Promise<string | null> => {
  if (nUserId <= 0) return '유효하지 않은 사용자입니다.';
  if (fnIsMysqlStore()) {
    const pool = fnGetMysqlAppPool();
    const [arrInst] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM event_instance WHERE n_created_by_user_id = ?',
      [nUserId],
    );
    const [arrActor] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM event_instance_stage_actor WHERE n_user_id = ?',
      [nUserId],
    );
    const nInst = Number(arrInst[0]?.n) || 0;
    const nActor = Number(arrActor[0]?.n) || 0;
    if (nInst > 0 || nActor > 0) {
      return (
        `이 사용자는 이벤트 데이터에서 참조 중이라 삭제할 수 없습니다. ` +
        `(생성 이벤트 ${nInst}건, 처리 이력 ${nActor}건)`
      );
    }
    return null;
  }
  const { arrEventInstances } = await import('./eventInstances');
  let nInst = 0;
  let nActor = 0;
  const arrActorFields = [
    'objConfirmer',
    'objQaRequester',
    'objQaDeployer',
    'objQaVerifier',
    'objLiveRequester',
    'objLiveDeployer',
    'objLiveVerifier',
  ] as const;
  for (const objInst of arrEventInstances) {
    if (objInst.objCreator?.nUserId === nUserId) nInst += 1;
    for (const strField of arrActorFields) {
      if (objInst[strField]?.nUserId === nUserId) nActor += 1;
    }
  }
  if (nInst > 0 || nActor > 0) {
    return (
      `이 사용자는 이벤트 데이터에서 참조 중이라 삭제할 수 없습니다. ` +
      `(생성 ${nInst}건, 처리자 기록 ${nActor}건)`
    );
  }
  return null;
};

/** MySQL ↔ 인메모리 사용자·역할 재로드 (삭제 실패 등 롤백용) */
export const fnReloadUsersFromMysql = async (): Promise<void> => {
  if (!fnIsMysqlStore()) {
    fnReloadUsersFromFile();
    return;
  }
  const pool = fnGetMysqlAppPool();
  const arrFromDb = await fnRelationalLoadUsers(pool);
  const arrUrFromDb = await fnRelationalLoadUserRoles(pool);
  arrUsers.length = 0;
  arrUsers.push(...arrFromDb);
  arrUserRoles.length = 0;
  arrUserRoles.push(...arrUrFromDb);
};

/** 사용자 CRUD 후 MySQL users·user_roles 만 즉시 반영 + JSON 미러 (전체 메타 치환 없음) */
export const fnCommitUserDataStore = async (): Promise<void> => {
  if (!fnIsMysqlStore()) return;
  await fnAwaitInFlightMysqlDocFlush();
  fnCancelAllPendingMysqlDocFlush();
  await fnSyncUsersOnlyToMysql([...arrUsers], [...arrUserRoles]);
  const arrFromDb = await fnRelationalLoadUsers(fnGetMysqlAppPool());
  arrUsers.length = 0;
  arrUsers.push(...arrFromDb);
  fnMirrorJsonToDisk(STR_FILE, arrUsers);
  fnMirrorJsonToDisk(STR_USER_ROLES_FILE, arrUserRoles);
};

/** users·user_roles 테이블만 갱신 (전체 메타 스냅샷 없음) */
const fnSyncUsersOnlyToMysql = async (
  arrRows: IUserRow[],
  arrUrRows: Array<{ nUserId: number; nRoleId: number }>,
): Promise<void> => {
  const pool = fnGetMysqlAppPool();
  const conn = await pool.getConnection();
  const setKeepIds = new Set(arrRows.map((r) => r.nId));
  const mapRoleIdsByUser = new Map<number, number[]>();
  for (const ur of arrUrRows) {
    if (!mapRoleIdsByUser.has(ur.nUserId)) mapRoleIdsByUser.set(ur.nUserId, []);
    mapRoleIdsByUser.get(ur.nUserId)!.push(ur.nRoleId);
  }
  try {
    await conn.beginTransaction();
    for (const row of arrRows) {
      const strDt = fnToMysqlDatetime6(row.dtCreatedAt || new Date().toISOString());
      await conn.execute(
        `INSERT INTO users (n_id, str_user_id, str_password, str_display_name, dt_created_at)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           str_user_id = VALUES(str_user_id),
           str_password = VALUES(str_password),
           str_display_name = VALUES(str_display_name),
           dt_created_at = VALUES(dt_created_at)`,
        [row.nId, row.strUserId, row.strPassword, row.strDisplayName, strDt],
      );
    }
    for (const nUserId of setKeepIds) {
      await conn.execute('DELETE FROM user_roles WHERE n_user_id = ?', [nUserId]);
      const arrRoleIds = mapRoleIdsByUser.get(nUserId) ?? [];
      for (const nRoleId of arrRoleIds) {
        await conn.execute('INSERT INTO user_roles (n_user_id, n_role_id) VALUES (?,?)', [
          nUserId,
          nRoleId,
        ]);
      }
    }
    const [arrDbIds] = await conn.query<RowDataPacket[]>('SELECT n_id FROM users');
    for (const objDb of arrDbIds) {
      const nId = Number(objDb.n_id);
      if (!setKeepIds.has(nId)) {
        await conn.execute('DELETE FROM user_roles WHERE n_user_id = ?', [nId]);
        await conn.execute('DELETE FROM users WHERE n_id = ?', [nId]);
      }
    }
    await conn.commit();
    console.log(`[users] MySQL users·user_roles 동기화 | ${arrRows.length}명`);
  } catch (err: unknown) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const fnUserRowFromJsonRecord = (raw: Record<string, unknown>): IUserRow | null => {
  const nId = Number(raw.nId);
  const strUserId = typeof raw.strUserId === 'string' ? raw.strUserId.trim() : '';
  const strPassword = typeof raw.strPassword === 'string' ? raw.strPassword : '';
  if (!Number.isFinite(nId) || nId <= 0 || !strUserId || !strPassword) return null;
  const strDisplayName = typeof raw.strDisplayName === 'string' ? raw.strDisplayName : strUserId;
  const dtCreatedAt =
    typeof raw.dtCreatedAt === 'string' ? raw.dtCreatedAt : new Date().toISOString();
  return { nId, strUserId, strPassword, strDisplayName, dtCreatedAt };
};

/**
 * data/users.json·userRoles.json → 인메모리 → MySQL (비밀번호·목록 불일치 복구용).
 * mysql 모드에서 로그인 실패 시 users.json 해시가 맞으면 이 경로로 맞춘다.
 */
export const fnRehydrateUsersFromJsonDisk = async (): Promise<number> => {
  const arrLoaded = fnReadJsonArrayFromDiskRaw<Record<string, unknown>>(STR_FILE);
  if (!arrLoaded?.length) {
    throw new Error(`users.json 없음 또는 비어 있음 (${STR_FILE})`);
  }
  const arrRows = arrLoaded
    .map((raw) => fnUserRowFromJsonRecord(raw))
    .filter((row): row is IUserRow => row != null);
  if (arrRows.length === 0) {
    throw new Error('users.json 에 유효한 사용자 행이 없습니다.');
  }
  arrUsers.length = 0;
  arrUsers.push(...arrRows);

  const arrUrLoaded = fnReadJsonArrayFromDiskRaw<{ nUserId: number; nRoleId: number }>(
    STR_USER_ROLES_FILE,
  );
  if (arrUrLoaded?.length) {
    arrUserRoles.length = 0;
    arrUserRoles.push(
      ...arrUrLoaded.filter(
        (ur) => Number.isFinite(ur.nUserId) && Number.isFinite(ur.nRoleId),
      ),
    );
  }

  if (fnIsMysqlStore()) {
    await fnCommitUserDataStore();
  } else {
    fnSaveJson(STR_FILE, arrUsers);
    const { fnSaveUserRoles } = await import('./userRoles');
    fnSaveUserRoles();
  }
  console.log(`[users] JSON 디스크 → 저장소 동기화 완료 | ${arrRows.length}명`);
  return arrRows.length;
};

export const fnGetNextId = (): number =>
  arrUsers.length > 0 ? Math.max(...arrUsers.map((u) => u.nId)) + 1 : 1;

/** nRoleId → strCode (roles 조회) */
const fnGetRoleCodesByRoleIds = (arrRoleIds: number[]): string[] =>
  arrRoleIds
    .map((nRoleId) => arrRoles.find((r) => r.nId === nRoleId)?.strCode)
    .filter((s): s is string => Boolean(s));

/** API용 IUser[] (arrRoles는 user_roles + roles에서 조립) */
export const fnGetUsersWithRoles = (): IUser[] =>
  arrUsers.map((u) => ({
    ...u,
    dtCreatedAt: new Date(u.dtCreatedAt),
    arrRoles: fnGetRoleCodesByRoleIds(fnGetRoleIdsByUserId(u.nId)),
  }));

/** strUserId로 조립된 사용자 1명 반환 (로그인/검증용) */
/** 파일에서 사용자 목록 다시 로드 (서버 재시작 없이 수동 추가 사용자 반영) */
export const fnReloadUsersFromFile = (): void => {
  if (fnIsMysqlStore()) return;
  const arrLoaded = fnLoadJson<IUserRow>(STR_FILE, ARR_SEED);
  arrUsers.length = 0;
  arrUsers.push(...arrLoaded);
};

/** strUserId로 조립된 사용자 1명 반환 (로그인/검증용) */
export const fnFindUserByStrUserId = (strUserId: string): IUser | undefined => {
  let row = arrUsers.find((u) => u.strUserId === strUserId);
  if (!row) {
    fnReloadUsersFromFile();
    row = arrUsers.find((u) => u.strUserId === strUserId);
  }
  if (!row) return undefined;
  return {
    ...row,
    dtCreatedAt: new Date(row.dtCreatedAt),
    arrRoles: fnGetRoleCodesByRoleIds(fnGetRoleIdsByUserId(row.nId)),
  };
};

export const fnFindUserRowById = (nId: number): IUserRow | undefined =>
  arrUsers.find((u) => u.nId === nId);

/** 사용자 역할 수정 후 저장 */
export const fnSaveUserAndRoles = (nUserId: number, arrRoleIds: number[]) => {
  fnSetRolesForUser(nUserId, arrRoleIds);
  fnSaveUserRoles();
  fnSaveUsers();
};

// 서버 시작 시 비밀번호 해시 초기화 (플레이스홀더인 경우에만)
export const fnInitUsers = async () => {
  let bChanged = false;
  const OBJ_DEFAULT_PASSWORDS: Record<string, string> = {
    admin: 'admin123',
    gm01:  'gm123',
    dba01: 'dba123',
    planner01: 'planner123',
  };

  for (const objUser of arrUsers) {
    if (objUser.strPassword === '__PENDING__') {
      const strDefault = OBJ_DEFAULT_PASSWORDS[objUser.strUserId] || 'changeme';
      objUser.strPassword = await bcrypt.hash(strDefault, 10);
      bChanged = true;
    }
  }

  if (bChanged) fnSaveJson(STR_FILE, arrUsers);
};

/** 특정 사용자 비밀번호 초기화 (설정용 API에서 사용, 파일·메모리 모두 반영) */
export const fnResetPasswordByUserId = async (strUserId: string, strNewPassword: string): Promise<boolean> => {
  fnReloadUsersFromFile();
  const row = arrUsers.find((u) => u.strUserId === strUserId);
  if (!row) return false;
  row.strPassword = await bcrypt.hash(strNewPassword, 10);
  fnSaveUsers();
  return true;
};
