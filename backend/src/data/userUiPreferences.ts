import fs from 'fs';
import path from 'path';

// jsonStore와 동일한 데이터 디렉터리
const STR_DATA_DIR = process.env.DATA_DIR ? path.resolve(process.cwd(), process.env.DATA_DIR) : path.join(process.cwd(), 'data');

const STR_FILE = 'userUiPreferences.json';

interface IFileRoot {
  /** 사용자 nId 문자열 → logical storage key → 값(원본 localStorage 문자열) */
  mapByUserId: Record<string, Record<string, string>>;
}

const fnEnsureDir = (): void => {
  if (!fs.existsSync(STR_DATA_DIR)) {
    fs.mkdirSync(STR_DATA_DIR, { recursive: true });
  }
};

const fnLoadRoot = (): IFileRoot => {
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
  fnEnsureDir();
  const strPath = path.join(STR_DATA_DIR, STR_FILE);
  try {
    fs.writeFileSync(strPath, JSON.stringify(objRoot, null, 2), 'utf-8');
  } catch (err: unknown) {
    console.error('[userUiPreferences] 저장 실패 |', err);
  }
};

export const fnGetUserUiPreferenceEntries = (nUserId: number): Record<string, string> => {
  if (nUserId <= 0) return {};
  const objRoot = fnLoadRoot();
  const objUser = objRoot.mapByUserId[String(nUserId)];
  return objUser && typeof objUser === 'object' ? { ...objUser } : {};
};

export const fnSetUserUiPreferenceEntries = (nUserId: number, objEntries: Record<string, string>): void => {
  if (nUserId <= 0) return;
  const objRoot = fnLoadRoot();
  objRoot.mapByUserId[String(nUserId)] = { ...objEntries };
  fnSaveRoot(objRoot);
};
