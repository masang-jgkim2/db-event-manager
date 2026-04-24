import { fnIsMysqlStore } from '../data/dataStore';
import { fnGetMysqlAppPool } from './mysqlAppPool';
import { fnRelationalWriteFullFromMemory } from './mysqlRelationalSync';

const mapPending = new Map<string, unknown[]>();
let refTimer: ReturnType<typeof setTimeout> | null = null;

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
  }
};

/** 인메모리 배열 변경 시 MySQL 정규화 테이블 전체 치환(짧은 디바운스) */
export const fnScheduleMysqlDocReplace = (strFilename: string, arrData: unknown[]): void => {
  mapPending.set(strFilename, arrData);
  if (refTimer != null) return;
  refTimer = setTimeout(() => {
    void fnFlushPending();
  }, 40);
};

/** 종료·테스트 전 대기용 */
export const fnAwaitMysqlDocFlush = async (): Promise<void> => {
  if (refTimer != null) {
    clearTimeout(refTimer);
    refTimer = null;
  }
  await fnFlushPending();
};
