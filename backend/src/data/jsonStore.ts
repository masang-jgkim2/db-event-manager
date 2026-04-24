import fs from 'fs';
import path from 'path';
import { fnIsMysqlStore } from './dataStore';
import { fnScheduleMysqlDocReplace } from '../db/mysqlDocPersist';

/** DATA_DIR 있으면 cwd 기준 절대경로. 없으면 이 파일 기준 backend/data (실행 cwd와 무관) */
function fnResolveDataDir(): string {
  const strEnv = process.env.DATA_DIR?.trim();
  if (strEnv) return path.resolve(process.cwd(), strEnv);
  // src/data 또는 dist/data → 상위 두 단계가 backend
  return path.join(__dirname, '..', '..', 'data');
}

export const STR_DATA_DIR = fnResolveDataDir();

// data 폴더가 없으면 자동 생성
if (!fs.existsSync(STR_DATA_DIR)) {
  fs.mkdirSync(STR_DATA_DIR, { recursive: true });
}

console.log(
  `[JsonStore] 데이터 디렉터리 | ${STR_DATA_DIR} | DATA_DIR=${process.env.DATA_DIR ?? '(미설정)'}`,
);

const ARR_PROBE_FILES = [
  'products.json',
  'events.json',
  'dbConnections.json',
  'eventInstances.json',
  'users.json',
  'roles.json',
  'rolePermissions.json',
];
if (!process.env.JEST_WORKER_ID) {
  for (const strProbe of ARR_PROBE_FILES) {
    const strP = path.join(STR_DATA_DIR, strProbe);
    const bExists = fs.existsSync(strP);
    const nSize = bExists ? fs.statSync(strP).size : 0;
    console.log(`[JsonStore] 파일 | ${strProbe} | exists=${bExists} | size=${nSize}`);
  }
}

// JSON 파일에서 배열 로드 (파일 없을 때만 시드 저장·반환; 파싱 실패 시 파일은 건드리지 않음)
export const fnLoadJson = <T>(strFilename: string, arrSeed: T[]): T[] => {
  // MySQL 모드: 부팅 시 `bootstrapDataStore`가 메모리를 채움 — 여기서는 디스크/시드로 채우지 않음
  if (fnIsMysqlStore()) {
    return [];
  }
  const strFilePath = path.join(STR_DATA_DIR, strFilename);
  try {
    if (fs.existsSync(strFilePath)) {
      const strContent = fs.readFileSync(strFilePath, 'utf-8');
      const parsed = JSON.parse(strContent) as unknown;
      if (!Array.isArray(parsed)) {
        console.error(
          `[JsonStore] ${strFilename} 루트가 배열이 아님 — 시드만 메모리에 사용(파일 유지)`,
        );
        return Array.isArray(arrSeed) ? [...arrSeed] : arrSeed;
      }
      return parsed as T[];
    }
  } catch (error: any) {
    console.error(
      `[JsonStore] ${strFilename} 로드/파싱 실패 — 시드만 메모리에 사용, 디스크 파일은 수정하지 않음 |`,
      error?.message,
    );
    return Array.isArray(arrSeed) ? [...arrSeed] : arrSeed;
  }
  fnSaveJson(strFilename, arrSeed);
  return arrSeed;
};

// 배열을 JSON 파일에 저장 (동기 쓰기 — 데이터 유실 방지)
export const fnSaveJson = <T>(strFilename: string, arrData: T[]): void => {
  if (fnIsMysqlStore()) {
    fnScheduleMysqlDocReplace(strFilename, arrData as unknown[]);
    return;
  }
  const strFilePath = path.join(STR_DATA_DIR, strFilename);
  try {
    fs.writeFileSync(strFilePath, JSON.stringify(arrData, null, 2), 'utf-8');
  } catch (error: any) {
    console.error(`[JsonStore] ${strFilename} 저장 실패:`, error.message);
  }
};

/** 디스크의 JSON 배열만 읽음 (파일 없음·파싱 실패·비배열 시 null, 시드 파일 자동 생성 없음) */
export const fnReadJsonArrayFromDisk = <T>(strFilename: string): T[] | null => {
  if (fnIsMysqlStore()) return null;
  const strFilePath = path.join(STR_DATA_DIR, strFilename);
  try {
    if (!fs.existsSync(strFilePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(strFilePath, 'utf-8')) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as T[];
  } catch (error: any) {
    console.warn(`[JsonStore] ${strFilename} 디스크 읽기 실패:`, error?.message);
    return null;
  }
};
