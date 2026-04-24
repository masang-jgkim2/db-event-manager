/** DQPM 앱 메타 저장소 — `DATA_STORE` 환경 변수 (게임 DB 접속과 별개) */

export type TDataStore = 'json' | 'mysql';

export const fnGetDataStore = (): TDataStore => {
  const str = (process.env.DATA_STORE ?? 'json').trim().toLowerCase();
  if (str === 'mysql' || str === 'rdb') return 'mysql';
  return 'json';
};

export const fnIsJsonStore = (): boolean => fnGetDataStore() === 'json';

export const fnIsMysqlStore = (): boolean => fnGetDataStore() === 'mysql';
