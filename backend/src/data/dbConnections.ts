import { IDbConnection } from '../types';

// DB 접속 정보 인메모리 저장소 (추후 DB 연동 시 교체)
export const arrDbConnections: IDbConnection[] = [];

// 다음 ID 자동 생성
export const fnGetNextDbConnectionId = (): number => {
  return arrDbConnections.length > 0
    ? Math.max(...arrDbConnections.map((c) => c.nId)) + 1
    : 1;
};

// 특정 프로덕트 + 환경의 활성 접속 정보 조회
export const fnFindActiveConnection = (
  nProductId: number,
  strEnv: 'dev' | 'qa' | 'live'
): IDbConnection | undefined => {
  return arrDbConnections.find(
    (c) => c.nProductId === nProductId && c.strEnv === strEnv && c.bIsActive
  );
};
