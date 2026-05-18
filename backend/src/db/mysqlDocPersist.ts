import { fnIsMysqlStore } from '../data/dataStore';
import { fnGetMysqlAppPool } from './mysqlAppPool';
import { fnRelationalWriteFullFromMemory } from './mysqlRelationalSync';

const mapPending = new Map<string, unknown[]>();
let refTimer: ReturnType<typeof setTimeout> | null = null;
let refFlushPromise: Promise<void> | null = null;

const fnFlushPending = async (): Promise<void> => {
  refTimer = null;
  if (!fnIsMysqlStore()) {
    mapPending.clear();
    return;
  }
  const pool = fnGetMysqlAppPool();
  const arrEntries = [...mapPending.entries()];
  mapPending.clear();
  if (arrEntries.length === 0) return;
  const strTriggers = arrEntries.map(([strFile]) => strFile).join(', ');
  try {
    console.log(`[DATA_MYSQL] 인메모리→MySQL 반영 시작 | 트리거=${strTriggers}`);
    await fnRelationalWriteFullFromMemory(pool);
    console.log(`[DATA_MYSQL] 인메모리→MySQL 반영 완료 | 트리거=${strTriggers}`);
  } catch (err: unknown) {
    console.error(`[DATA_MYSQL] 동기화 실패 |`, (err as Error)?.message);
    throw err;
  } finally {
    refFlushPromise = null;
  }
};

/** 예약된 전체 치환·진행 중 flush 모두 취소/대기 (사용자 삭제 등 직전) */
export const fnCancelAllPendingMysqlDocFlush = (): void => {
  if (refTimer != null) {
    clearTimeout(refTimer);
    refTimer = null;
  }
  mapPending.clear();
};

export const fnAwaitInFlightMysqlDocFlush = async (): Promise<void> => {
  if (refTimer != null) {
    clearTimeout(refTimer);
    refTimer = null;
    await fnFlushPending().catch((err: unknown) => {
      console.error('[DATA_MYSQL] 대기 중 flush 실패 |', (err as Error)?.message);
    });
    return;
  }
  if (refFlushPromise) {
    await refFlushPromise.catch(() => {});
  }
};

/** 인메모리 배열 변경 시 MySQL 정규화 테이블 전체 치환(짧은 디바운스) */
export const fnScheduleMysqlDocReplace = (strFilename: string, arrData: unknown[]): void => {
  mapPending.set(strFilename, arrData);
  if (refTimer != null) return;
  refTimer = setTimeout(() => {
    refFlushPromise = fnFlushPending().catch((err: unknown) => {
      console.error('[DATA_MYSQL] 백그라운드 동기화 실패 |', (err as Error)?.message);
    });
  }, 40);
};

/** users·userRoles 저장 시 예약된 전체 치환 취소(fnCommitUserDataStore 전용) */
export const fnCancelMysqlUserDocFlush = (): void => {
  fnCancelMysqlDocFlushForFiles(['users.json', 'userRoles.json']);
};

/** 지정 JSON 파일 트리거로 예약된 전체 치환 취소 */
export const fnCancelMysqlDocFlushForFiles = (arrFilenames: string[]): void => {
  for (const strFile of arrFilenames) {
    mapPending.delete(strFile);
  }
  if (mapPending.size === 0 && refTimer != null) {
    clearTimeout(refTimer);
    refTimer = null;
  }
};

/** 종료·테스트 전 대기용 */
export const fnAwaitMysqlDocFlush = async (): Promise<void> => {
  if (refTimer != null) {
    clearTimeout(refTimer);
    refTimer = null;
  }
  await fnFlushPending();
};
