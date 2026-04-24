import fs from 'fs';
import path from 'path';
import { STR_DATA_DIR } from './jsonStore';
import { fnIsMysqlStore } from './dataStore';
import { fnGetMysqlAppPool } from '../db/mysqlAppPool';
import { fnMysqlLoadUserUiRoot, fnMysqlReplaceUserUiRoot } from '../db/mysqlAppDataAccess';

const STR_FILE = 'userUiPreferences.json';

interface IFileRoot {
  /** 사용자 nId 문자열 → logical storage key → 값(원본 localStorage 문자열) */
  mapByUserId: Record<string, Record<string, string>>;
}

/** MySQL 모드: 부팅 시 채워지는 인메모리 루트(파일 미사용) */
let g_objMysqlUiRoot: IFileRoot = { mapByUserId: {} };
let refMysqlUiTimer: ReturnType<typeof setTimeout> | null = null;

const fnEnsureDir = (): void => {
  if (!fs.existsSync(STR_DATA_DIR)) {
    fs.mkdirSync(STR_DATA_DIR, { recursive: true });
  }
};

const fnLoadRoot = (): IFileRoot => {
  if (fnIsMysqlStore()) {
    return g_objMysqlUiRoot;
  }
  fnEnsureDir();
  const strPath = path.join(STR_DATA_DIR, STR_FILE);
  try {
    if (fs.existsSync(strPath)) {
      const obj = JSON.parse(fs.readFileSync(strPath, 'utf-8')) as IFileRoot;
      if (obj && typeof obj.mapByUserId === 'object' && obj.mapByUserId !== null) {
        return obj;
      }
    }
  } catch (err: unknown) {
    console.error('[userUiPreferences] 로드 실패 |', err);
  }
  return { mapByUserId: {} };
};

const fnSaveRoot = (objRoot: IFileRoot): void => {
  if (fnIsMysqlStore()) {
    g_objMysqlUiRoot = objRoot;
    if (refMysqlUiTimer != null) clearTimeout(refMysqlUiTimer);
    refMysqlUiTimer = setTimeout(() => {
      refMysqlUiTimer = null;
      void (async () => {
        try {
          const pool = fnGetMysqlAppPool();
          await fnMysqlReplaceUserUiRoot(pool, g_objMysqlUiRoot);
          const nUsers = Object.keys(g_objMysqlUiRoot.mapByUserId ?? {}).length;
          console.log(`[userUiPreferences] MySQL 동기화 완료 | user_ui_preference | 사용자=${nUsers}명`);
        } catch (err: unknown) {
          console.error('[userUiPreferences] MySQL 동기화 실패 |', err);
        }
      })();
    }, 80);
    return;
  }
  fnEnsureDir();
  const strPath = path.join(STR_DATA_DIR, STR_FILE);
  try {
    fs.writeFileSync(strPath, JSON.stringify(objRoot, null, 2), 'utf-8');
  } catch (err: unknown) {
    console.error('[userUiPreferences] 저장 실패 |', err);
  }
};

/** MySQL 하이드레이트 — `bootstrapDataStore`에서만 호출 */
export const fnHydrateUserUiPreferencesFromMysql = async (): Promise<void> => {
  const pool = fnGetMysqlAppPool();
  g_objMysqlUiRoot = await fnMysqlLoadUserUiRoot(pool);
  const nUsers = Object.keys(g_objMysqlUiRoot.mapByUserId ?? {}).length;
  console.log(`[DataStore] 로드 완료 | user_ui_preference·userUiPreferences.json | 사용자=${nUsers}명`);
};

/** 정규화 전체 스냅샷 저장 시 인메모리 UI 루트 복사 */
export const fnGetUserUiRootForMysql = (): IFileRoot => ({
  mapByUserId: JSON.parse(JSON.stringify(g_objMysqlUiRoot.mapByUserId ?? {})) as Record<
    string,
    Record<string, string>
  >,
});

export const fnGetUserUiPreferenceEntries = (nUserId: number): Record<string, string> => {
  if (nUserId <= 0) return {};
  if (fnIsMysqlStore()) {
    const objUser = g_objMysqlUiRoot.mapByUserId[String(nUserId)];
    return objUser && typeof objUser === 'object' ? { ...objUser } : {};
  }
  const objRoot = fnLoadRoot();
  const objUser = objRoot.mapByUserId[String(nUserId)];
  return objUser && typeof objUser === 'object' ? { ...objUser } : {};
};

export const fnSetUserUiPreferenceEntries = (nUserId: number, objEntries: Record<string, string>): void => {
  if (nUserId <= 0) return;
  if (fnIsMysqlStore()) {
    if (!g_objMysqlUiRoot.mapByUserId) g_objMysqlUiRoot.mapByUserId = {};
    g_objMysqlUiRoot.mapByUserId[String(nUserId)] = { ...objEntries };
    fnSaveRoot(g_objMysqlUiRoot);
    return;
  }
  const objRoot = fnLoadRoot();
  objRoot.mapByUserId[String(nUserId)] = { ...objEntries };
  fnSaveRoot(objRoot);
};
