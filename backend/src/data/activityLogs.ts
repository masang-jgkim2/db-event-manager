import { fnLoadJson, fnSaveJson } from './jsonStore';
import { fnBroadcastActivityLog } from '../services/sseBroadcaster';

/**
 * HTTP 활동 로그 (인메모리+JSON).
 * 대량 누적 대응: (1) 상한 초과 시 오래된 행부터 삭제 — `ACTIVITY_LOG_MAX_ROWS`(기본 10000)
 * (2) MySQL 등 전환 시 전용 테이블+인덱스(dt_at, str_category, n_actor_user_id) 및 파티션·보관 주기
 * (3) 디스크 보존이 필요하면 주기적 export 또는 WAL 분리 검토
 *
 * 디스크 쓰기: 요청마다 `writeFileSync` 대신 배치 flush — `ACTIVITY_LOG_FLUSH_MS`(기본 2000),
 * `ACTIVITY_LOG_FLUSH_EVERY`(기본 200건 누적 시 즉시 저장). 비정상 종료 시 직전 flush 이후 로그 유실 가능.
 * `ACTIVITY_LOG_ENABLED`: **명시적 옵트인** — `1`/`true`/`on`/`yes`만 기록. 그 외(미설정·`0` 등)는 비기록.
 */
/** 활동 로그 대분류 (필터용) */
export type TActivityCategory = 'auth' | 'event' | 'user' | 'ops' | 'other';

const STR_FILE = 'activity_logs.json';
const N_MAX_ROWS = Math.max(1000, Math.min(500000, Number(process.env.ACTIVITY_LOG_MAX_ROWS) || 10000));
const N_FLUSH_DEBOUNCE_MS = Math.max(100, Math.min(120_000, Number(process.env.ACTIVITY_LOG_FLUSH_MS) || 2000));
const N_FLUSH_EVERY_N_PUSHES = Math.max(1, Math.min(50_000, Number(process.env.ACTIVITY_LOG_FLUSH_EVERY) || 200));

export interface IActivityLogRow {
  nId: number;
  dtAt: string;
  strMethod: string;
  strPath: string;
  nStatusCode: number;
  nActorUserId: number | null;
  strActorUserId: string | null;
  /** 요청 시점 JWT·사용자 기준 역할 코드(구 로그는 없을 수 있음) */
  arrActorRoles: string[] | null;
  strCategory: TActivityCategory;
}

type TActivityLogRowFile = Omit<IActivityLogRow, 'arrActorRoles'> & { arrActorRoles?: string[] | null };

export const arrActivityLogs: IActivityLogRow[] = fnLoadJson<TActivityLogRowFile>(STR_FILE, []).map((r) => ({
  ...r,
  arrActorRoles: r.arrActorRoles ?? null,
}));

/** 로드된 행 기준 다음 nId (매 push마다 O(n) 스캔 방지) */
const fnInitNextIdFromLoaded = (): number => {
  let nMax = 0;
  for (const r of arrActivityLogs) {
    if (r.nId > nMax) nMax = r.nId;
  }
  return nMax + 1;
};
let nNextActivityLogId = fnInitNextIdFromLoaded();

let bActivityLogsDirty = false;
let nPushCountSinceFlush = 0;
let refFlushTimer: ReturnType<typeof setTimeout> | null = null;

const fnCancelActivityLogsFlushTimer = (): void => {
  if (refFlushTimer != null) {
    clearTimeout(refFlushTimer);
    refFlushTimer = null;
  }
};

/** MySQL 하이드레이트 후 메모리·다음 ID 재바인딩 */
export const fnRehydrateActivityLogsFromDocs = (arrDocs: IActivityLogRow[]): void => {
  fnCancelActivityLogsFlushTimer();
  arrActivityLogs.length = 0;
  arrActivityLogs.push(
    ...arrDocs.map((r) => ({
      ...r,
      arrActorRoles: r.arrActorRoles ?? null,
    })),
  );
  nNextActivityLogId = fnInitNextIdFromLoaded();
  bActivityLogsDirty = false;
  nPushCountSinceFlush = 0;
};

/** 메모리 → JSON 동기 저장(배치 flush·종료 시·전체 삭제 후) */
export const fnFlushActivityLogsToDisk = (): void => {
  fnCancelActivityLogsFlushTimer();
  if (!bActivityLogsDirty) return;
  bActivityLogsDirty = false;
  nPushCountSinceFlush = 0;
  fnSaveJson(STR_FILE, arrActivityLogs);
};

const fnScheduleActivityLogsDebouncedFlush = (): void => {
  fnCancelActivityLogsFlushTimer();
  refFlushTimer = setTimeout(() => {
    refFlushTimer = null;
    fnFlushActivityLogsToDisk();
  }, N_FLUSH_DEBOUNCE_MS);
};

// Jest: 타이머 없이 매 건 저장해 테스트·파일 상태 결정적 유지
const bActivityLogSyncEveryPush = Boolean(process.env.JEST_WORKER_ID);

if (!process.env.JEST_WORKER_ID) {
  const fnOnShutdownFlush = () => {
    try {
      fnFlushActivityLogsToDisk();
    } catch (err: unknown) {
      console.error('[활동 로그] 종료 시 저장 실패 |', err);
    }
  };
  process.once('SIGINT', fnOnShutdownFlush);
  process.once('SIGTERM', fnOnShutdownFlush);
}

/** API 경로 → 필터 카테고리 (쿼리스트링 제외된 path 기준) */
export const fnResolveActivityCategory = (strPath: string): TActivityCategory => {
  if (strPath.startsWith('/api/auth')) return 'auth';
  if (strPath.startsWith('/api/events') || strPath.startsWith('/api/event-instances')) return 'event';
  if (strPath.startsWith('/api/users') || strPath.startsWith('/api/roles')) return 'user';
  if (
    strPath.startsWith('/api/products')
    || strPath.startsWith('/api/db-connections')
    || strPath.startsWith('/api/admin')
  ) {
    return 'ops';
  }
  return 'other';
};

export interface IPushActivityInput {
  strMethod: string;
  strPath: string;
  nStatusCode: number;
  nActorUserId: number | null;
  strActorUserId: string | null;
  arrActorRoles?: string[] | null;
}

/** HTTP·로그인 등 활동 기록 — `ACTIVITY_LOG_ENABLED=1`(또는 true/on/yes)일 때만. Jest는 항상 기록 */
export const fnIsActivityLogEnabled = (): boolean => {
  if (process.env.JEST_WORKER_ID) return true;
  const strRaw = process.env.ACTIVITY_LOG_ENABLED?.trim().toLowerCase();
  return strRaw === '1' || strRaw === 'true' || strRaw === 'on' || strRaw === 'yes';
};

/** 활동 1건 추가 (메모리 즉시·디스크는 배치 flush, SSE 즉시) */
export const fnPushActivityLog = (objInput: IPushActivityInput): void => {
  if (!fnIsActivityLogEnabled()) return;

  const strPath = objInput.strPath.split('?')[0] || objInput.strPath;
  const arrRoles =
    objInput.arrActorRoles != null && objInput.arrActorRoles.length > 0
      ? [...objInput.arrActorRoles]
      : null;
  const objRow: IActivityLogRow = {
    nId: nNextActivityLogId++,
    dtAt: new Date().toISOString(),
    strMethod: objInput.strMethod,
    strPath: strPath,
    nStatusCode: objInput.nStatusCode,
    nActorUserId: objInput.nActorUserId,
    strActorUserId: objInput.strActorUserId,
    arrActorRoles: arrRoles,
    strCategory: fnResolveActivityCategory(strPath),
  };
  arrActivityLogs.push(objRow);
  while (arrActivityLogs.length > N_MAX_ROWS) {
    arrActivityLogs.shift();
  }
  bActivityLogsDirty = true;
  nPushCountSinceFlush++;
  if (bActivityLogSyncEveryPush || nPushCountSinceFlush >= N_FLUSH_EVERY_N_PUSHES) {
    fnFlushActivityLogsToDisk();
  } else {
    fnScheduleActivityLogsDebouncedFlush();
  }
  try {
    fnBroadcastActivityLog(objRow);
  } catch (err: unknown) {
    console.error('[활동 로그] SSE 브로드캐스트 실패 |', err);
  }
};

export interface IActivityActorOption {
  nActorUserId: number | null;
  strActorUserId: string | null;
  strLabel: string;
}

/**
 * 로그에 나온 행위자 목록(라벨 정렬).
 * - 로그인 아이디가 있으면 아이디 기준 1행만 — (null, gm01) vs (5, gm01) 같이 nId만 다른 중복 제거.
 * - 아이디 없고 nActorUserId만 있으면 #숫자.
 * - 둘 다 없으면 라벨 "미기재"(행위자 미기재 로그만 필터).
 */
export const fnListDistinctActivityActors = (): IActivityActorOption[] => {
  const mapActors = new Map<string, IActivityActorOption>();
  for (const r of arrActivityLogs) {
    const strUid = (r.strActorUserId || '').trim();
    let strK: string;
    if (strUid) {
      strK = `u:${strUid}`;
    } else if (r.nActorUserId != null) {
      strK = `n:${r.nActorUserId}`;
    } else {
      strK = '_none';
    }
    if (mapActors.has(strK)) continue;

    if (strK.startsWith('u:')) {
      mapActors.set(strK, {
        nActorUserId: null,
        strActorUserId: strUid,
        strLabel: strUid,
      });
    } else if (strK.startsWith('n:')) {
      mapActors.set(strK, {
        nActorUserId: r.nActorUserId,
        strActorUserId: null,
        strLabel: `#${r.nActorUserId}`,
      });
    } else {
      mapActors.set(strK, {
        nActorUserId: null,
        strActorUserId: null,
        strLabel: '미기재',
      });
    }
  }
  return [...mapActors.values()].sort((a, b) => a.strLabel.localeCompare(b.strLabel, 'ko'));
};

export interface IQueryActivityInput {
  strCategory: 'all' | TActivityCategory;
  nLimit: number;
  nOffset: number;
  /** ISO 시각 이상 (포함) */
  strDtFrom?: string;
  /** ISO 시각 이하 (포함) */
  strDtTo?: string;
  /** GET, POST … 대소문자 무시 후 대문자 일치 */
  strMethod?: string;
  /** 아이디 또는 숫자 userId 부분 일치(대소문자 무시) — 정확 필터 미사용 시만 */
  strActor?: string;
  /** nActorUserId 정확 일치(드롭다운) */
  nActorUserIdEq?: number;
  /** strActorUserId 컬럼 정확 일치(드롭다운) */
  strActorUserIdEq?: string;
  /** 행위자 미기재 로그만 */
  bActorNone?: boolean;
  /** HTTP 상태 코드 일치 */
  nStatusCode?: number;
}

/** 인메모리·JSON 파일의 활동 로그 전부 제거(복구 불가) */
export const fnClearAllActivityLogs = (): void => {
  fnCancelActivityLogsFlushTimer();
  arrActivityLogs.length = 0;
  nNextActivityLogId = 1;
  bActivityLogsDirty = false;
  nPushCountSinceFlush = 0;
  fnSaveJson(STR_FILE, arrActivityLogs);
};

export const fnQueryActivityLogs = (objQuery: IQueryActivityInput): { arrRows: IActivityLogRow[]; nTotal: number } => {
  let arrFiltered =
    objQuery.strCategory === 'all'
      ? [...arrActivityLogs]
      : arrActivityLogs.filter((r) => r.strCategory === objQuery.strCategory);

  if (objQuery.strDtFrom) {
    const tFrom = new Date(objQuery.strDtFrom).getTime();
    arrFiltered = arrFiltered.filter((r) => new Date(r.dtAt).getTime() >= tFrom);
  }
  if (objQuery.strDtTo) {
    const tTo = new Date(objQuery.strDtTo).getTime();
    arrFiltered = arrFiltered.filter((r) => new Date(r.dtAt).getTime() <= tTo);
  }
  if (objQuery.strMethod) {
    const strM = objQuery.strMethod.toUpperCase();
    arrFiltered = arrFiltered.filter((r) => r.strMethod.toUpperCase() === strM);
  }
  if (objQuery.bActorNone) {
    arrFiltered = arrFiltered.filter((r) => r.nActorUserId == null && r.strActorUserId == null);
  } else {
    const bExactActor =
      (objQuery.nActorUserIdEq != null && !Number.isNaN(objQuery.nActorUserIdEq))
      || (objQuery.strActorUserIdEq != null && objQuery.strActorUserIdEq !== '');
    if (bExactActor) {
      if (objQuery.nActorUserIdEq != null && !Number.isNaN(objQuery.nActorUserIdEq)) {
        arrFiltered = arrFiltered.filter((r) => r.nActorUserId === objQuery.nActorUserIdEq);
      }
      if (objQuery.strActorUserIdEq != null && objQuery.strActorUserIdEq !== '') {
        arrFiltered = arrFiltered.filter((r) => r.strActorUserId === objQuery.strActorUserIdEq);
      }
    } else if (objQuery.strActor && objQuery.strActor.trim()) {
      const strQ = objQuery.strActor.trim().toLowerCase();
      arrFiltered = arrFiltered.filter((r) => {
        const strUid = (r.strActorUserId || '').toLowerCase();
        const strNum = r.nActorUserId != null ? String(r.nActorUserId) : '';
        return strUid.includes(strQ) || strNum.includes(strQ);
      });
    }
  }
  if (objQuery.nStatusCode != null && !Number.isNaN(objQuery.nStatusCode)) {
    arrFiltered = arrFiltered.filter((r) => r.nStatusCode === objQuery.nStatusCode);
  }

  const nTotal = arrFiltered.length;
  const arrSorted = arrFiltered.sort((a, b) => new Date(b.dtAt).getTime() - new Date(a.dtAt).getTime());
  const arrSlice = arrSorted.slice(objQuery.nOffset, objQuery.nOffset + objQuery.nLimit);
  return { arrRows: arrSlice, nTotal };
};
