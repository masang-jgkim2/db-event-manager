import fs from 'fs';
import path from 'path';

// JSON 파일 저장 경로 — 프로젝트 루트의 /data 폴더
const STR_DATA_DIR = path.join(process.cwd(), 'data');

// data 폴더가 없으면 자동 생성
if (!fs.existsSync(STR_DATA_DIR)) {
  fs.mkdirSync(STR_DATA_DIR, { recursive: true });
}

// JSON 파일에서 배열 로드 (파일 없으면 시드 데이터 반환)
export const fnLoadJson = <T>(strFilename: string, arrSeed: T[]): T[] => {
  const strFilePath = path.join(STR_DATA_DIR, strFilename);
  try {
    if (fs.existsSync(strFilePath)) {
      const strContent = fs.readFileSync(strFilePath, 'utf-8');
      return JSON.parse(strContent) as T[];
    }
  } catch (error: any) {
    console.warn(`[JsonStore] ${strFilename} 로드 실패, 시드 데이터 사용:`, error.message);
  }
  // 파일이 없으면 시드 데이터를 즉시 저장하고 반환
  fnSaveJson(strFilename, arrSeed);
  return arrSeed;
};

// 배열을 JSON 파일에 저장 (동기 쓰기 — 데이터 유실 방지)
export const fnSaveJson = <T>(strFilename: string, arrData: T[]): void => {
  const strFilePath = path.join(STR_DATA_DIR, strFilename);
  try {
    fs.writeFileSync(strFilePath, JSON.stringify(arrData, null, 2), 'utf-8');
  } catch (error: any) {
    console.error(`[JsonStore] ${strFilename} 저장 실패:`, error.message);
  }
};
