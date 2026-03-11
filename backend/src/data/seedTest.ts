import fs from 'fs';
import path from 'path';
import { arrProducts } from './products';
import { arrEvents } from './events';
import { arrUsers } from './users';
import { arrRoles } from './roles';
import { arrDbConnections } from './dbConnections';
import { arrEventInstances } from './eventInstances';

// 테스트 초기화 데이터 파일명 (서버 재시작 시 이 파일이 있으면 우선 로드)
const STR_SEED_FILENAME = 'seed_test.json';
const STR_DATA_DIR = path.join(process.cwd(), 'data');

export interface ISeedData {
  products: unknown[];
  events: unknown[];
  users: unknown[];
  roles: unknown[];
  dbConnections: unknown[];
  eventInstances: unknown[];
}

// seed_test.json 존재 여부
export const fnHasSeedTest = (): boolean => {
  const strPath = path.join(STR_DATA_DIR, STR_SEED_FILENAME);
  return fs.existsSync(strPath);
};

// 테스트 초기화 데이터 로드 (파일 없거나 오류 시 null)
export const fnLoadSeedTest = (): ISeedData | null => {
  const strPath = path.join(STR_DATA_DIR, STR_SEED_FILENAME);
  try {
    if (!fs.existsSync(strPath)) return null;
    const strContent = fs.readFileSync(strPath, 'utf-8');
    const obj = JSON.parse(strContent) as ISeedData;
    if (!obj || typeof obj !== 'object') return null;
    return {
      products: Array.isArray(obj.products) ? obj.products : [],
      events: Array.isArray(obj.events) ? obj.events : [],
      users: Array.isArray(obj.users) ? obj.users : [],
      roles: Array.isArray(obj.roles) ? obj.roles : [],
      dbConnections: Array.isArray(obj.dbConnections) ? obj.dbConnections : [],
      eventInstances: Array.isArray(obj.eventInstances) ? obj.eventInstances : [],
    };
  } catch (error: unknown) {
    console.warn('[SeedTest] 테스트 초기화 데이터 로드 실패:', (error as Error)?.message);
    return null;
  }
};

// 메모리 배열을 시드 데이터로 덮어씀 (기존 배열 참조 유지)
export const fnApplySeedToMemory = (seed: ISeedData): void => {
  arrProducts.length = 0;
  arrProducts.push(...(seed.products as typeof arrProducts));

  arrEvents.length = 0;
  arrEvents.push(...(seed.events as typeof arrEvents));

  arrUsers.length = 0;
  arrUsers.push(...(seed.users as typeof arrUsers));

  arrRoles.length = 0;
  arrRoles.push(...(seed.roles as typeof arrRoles));

  arrDbConnections.length = 0;
  arrDbConnections.push(...(seed.dbConnections as typeof arrDbConnections));

  arrEventInstances.length = 0;
  arrEventInstances.push(...(seed.eventInstances as typeof arrEventInstances));
};

// 현재 메모리 데이터를 테스트 초기화 데이터(seed_test.json)로 저장
export const fnSaveSeedTest = (): void => {
  const objSeed: ISeedData = {
    products: [...arrProducts],
    events: [...arrEvents],
    users: [...arrUsers],
    roles: [...arrRoles],
    dbConnections: [...arrDbConnections],
    eventInstances: [...arrEventInstances],
  };

  if (!fs.existsSync(STR_DATA_DIR)) {
    fs.mkdirSync(STR_DATA_DIR, { recursive: true });
  }
  const strPath = path.join(STR_DATA_DIR, STR_SEED_FILENAME);
  try {
    fs.writeFileSync(strPath, JSON.stringify(objSeed, null, 2), 'utf-8');
    console.log(`[SeedTest] 테스트 초기화 데이터 저장됨: ${STR_SEED_FILENAME}`);
  } catch (error: unknown) {
    console.error('[SeedTest] 테스트 초기화 데이터 저장 실패:', (error as Error)?.message);
  }
};
