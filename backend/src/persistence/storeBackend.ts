/** 앱 도메인 영속 백엔드: JSON 파일 vs 시스템 RDB (단일 스위치) */
export type TStoreBackend = 'json' | 'rdb';

export const fnGetStoreBackend = (): TStoreBackend => {
  const str = (process.env.STORE_BACKEND || 'json').trim().toLowerCase();
  if (str === 'rdb') return 'rdb';
  return 'json';
};

export const fnIsJsonBackend = (): boolean => fnGetStoreBackend() === 'json';
export const fnIsRdbBackend = (): boolean => fnGetStoreBackend() === 'rdb';
