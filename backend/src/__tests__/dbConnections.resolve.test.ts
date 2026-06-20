import {
  arrDbConnections,
  fnConnectionMatchesServiceScope,
  fnFindActiveConnectionByKindAndService,
  fnHasEnvConnectionForKindAndService,
  fnResolveExecuteConnection,
} from '../data/dbConnections';
import type { IDbConnection } from '../types';

const fnSeedConnections = (arr: IDbConnection[]) => {
  arrDbConnections.length = 0;
  arrDbConnections.push(...arr);
};

describe('dbConnection service scope', () => {
  afterEach(() => {
    arrDbConnections.length = 0;
  });

  it('fnConnectionMatchesServiceScope — CC↔CC/KR 레거시 호환', () => {
    const objLegacy = { strServiceAbbr: 'CC' } as IDbConnection;
    const objNew = { strServiceAbbr: 'CC/KR' } as IDbConnection;
    expect(fnConnectionMatchesServiceScope(objLegacy, 'CC/KR')).toBe(true);
    expect(fnConnectionMatchesServiceScope(objNew, 'CC')).toBe(true);
    expect(fnConnectionMatchesServiceScope(objNew, 'DK/KR')).toBe(false);
  });

  it('CC 접속 + CC/KR 프로덕트 — QA/LIVE deploy 연결 인식', () => {
    fnSeedConnections([
      {
        nId: 7,
        nProductId: 3,
        strProductName: '콜오브카오스',
        strServiceAbbr: 'CC',
        strKind: 'GAME',
        strEnv: 'qa',
        strDbType: 'mssql',
        strHost: '10.0.0.7',
        nPort: 1433,
        strDatabase: 'GameDB',
        strUser: 'u',
        strPassword: 'p',
        bIsActive: true,
        dtCreatedAt: '',
        dtUpdatedAt: '',
      },
      {
        nId: 8,
        nProductId: 3,
        strProductName: '콜오브카오스',
        strServiceAbbr: 'CC',
        strKind: 'GAME',
        strEnv: 'live',
        strDbType: 'mssql',
        strHost: '10.0.0.8',
        nPort: 1433,
        strDatabase: 'GameDB',
        strUser: 'u',
        strPassword: 'p',
        bIsActive: true,
        dtCreatedAt: '',
        dtUpdatedAt: '',
      },
    ]);
    expect(fnHasEnvConnectionForKindAndService(3, 'CC/KR', 'qa', 'GAME')).toBe(true);
    expect(fnHasEnvConnectionForKindAndService(3, 'CC/KR', 'live', 'GAME')).toBe(true);
    expect(fnFindActiveConnectionByKindAndService(3, 'qa', 'GAME', 'CC/KR')?.nId).toBe(7);
  });

  it('fnConnectionMatchesServiceScope — 공통 접속은 모든 서비스와 호환', () => {
    const objCommon = { strServiceAbbr: undefined } as IDbConnection;
    expect(fnConnectionMatchesServiceScope(objCommon, 'DK/G')).toBe(true);
    expect(fnConnectionMatchesServiceScope({ strServiceAbbr: 'DK/KR' } as IDbConnection, 'DK/G')).toBe(false);
  });

  it('DK/KR 전용 QA GAME — DK/G 선택 시 해석 불가', () => {
    fnSeedConnections([
      {
        nId: 1,
        nProductId: 2,
        strProductName: 'DK온라인',
        strServiceAbbr: 'DK/KR',
        strKind: 'GAME',
        strEnv: 'qa',
        strDbType: 'mssql',
        strHost: '10.0.0.1',
        nPort: 1433,
        strDatabase: 'GameDB',
        strUser: 'u',
        strPassword: 'p',
        bIsActive: true,
        dtCreatedAt: '',
        dtUpdatedAt: '',
      },
    ]);
    expect(fnFindActiveConnectionByKindAndService(2, 'qa', 'GAME', 'DK/G')).toBeUndefined();
    expect(fnFindActiveConnectionByKindAndService(2, 'qa', 'GAME', 'DK/KR')?.nId).toBe(1);
  });

  it('LH/KR — WEB·GAME 종류별 QA/LIVE 각각 해석', () => {
    fnSeedConnections([
      {
        nId: 10,
        nProductId: 5,
        strProductName: '라그하임',
        strServiceAbbr: 'LH/KR',
        strKind: 'WEB',
        strEnv: 'qa',
        strDbType: 'mysql',
        strHost: '10.0.0.10',
        nPort: 3306,
        strDatabase: 'webdb',
        strUser: 'u',
        strPassword: 'p',
        bIsActive: true,
        dtCreatedAt: '',
        dtUpdatedAt: '',
      },
      {
        nId: 11,
        nProductId: 5,
        strProductName: '라그하임',
        strServiceAbbr: 'LH/KR',
        strKind: 'GAME',
        strEnv: 'qa',
        strDbType: 'mssql',
        strHost: '10.0.0.11',
        nPort: 1433,
        strDatabase: 'gamedb',
        strUser: 'u',
        strPassword: 'p',
        bIsActive: true,
        dtCreatedAt: '',
        dtUpdatedAt: '',
      },
    ]);
    expect(fnHasEnvConnectionForKindAndService(5, 'LH/KR', 'qa', 'WEB')).toBe(true);
    expect(fnHasEnvConnectionForKindAndService(5, 'LH/KR', 'qa', 'GAME')).toBe(true);
    expect(fnHasEnvConnectionForKindAndService(5, 'LH/KR', 'live', 'WEB')).toBe(false);
    expect(fnResolveExecuteConnection(5, 'qa', 10, 'LH/KR')?.strKind).toBe('WEB');
    expect(fnResolveExecuteConnection(5, 'qa', 11, 'LH/KR')?.strKind).toBe('GAME');
  });

  it('서비스 전용 없으면 공통 fallback', () => {
    fnSeedConnections([
      {
        nId: 20,
        nProductId: 2,
        strProductName: 'DK온라인',
        strKind: 'GAME',
        strEnv: 'qa',
        strDbType: 'mssql',
        strHost: '10.0.0.20',
        nPort: 1433,
        strDatabase: 'CommonDB',
        strUser: 'u',
        strPassword: 'p',
        bIsActive: true,
        dtCreatedAt: '',
        dtUpdatedAt: '',
      },
    ]);
    expect(fnFindActiveConnectionByKindAndService(2, 'qa', 'GAME', 'DK/G')?.nId).toBe(20);
  });
});

describe('fnResolveExecuteConnection', () => {
  afterEach(() => {
    arrDbConnections.length = 0;
  });

  it('nDbConnectionId 없으면 GAME 종류 활성 접속', () => {
    fnSeedConnections([
      {
        nId: 1,
        nProductId: 1,
        strProductName: 'P',
        strKind: 'GAME',
        strEnv: 'qa',
        strDbType: 'mssql',
        strHost: 'h',
        nPort: 1433,
        strDatabase: 'd',
        strUser: 'u',
        strPassword: 'p',
        bIsActive: true,
        dtCreatedAt: '',
        dtUpdatedAt: '',
      },
    ]);
    const objConn = fnResolveExecuteConnection(1, 'qa');
    expect(objConn).toBeDefined();
    expect(objConn?.strKind ?? 'GAME').toBe('GAME');
    expect(objConn?.nProductId).toBe(1);
    expect(objConn?.strEnv).toBe('qa');
    expect(objConn?.bIsActive).toBe(true);
  });

  it('nDbConnectionId 지정 시 동일 프로덕트·요청 env면 해당 접속', () => {
    fnSeedConnections([
      {
        nId: 1,
        nProductId: 1,
        strProductName: 'P',
        strKind: 'GAME',
        strEnv: 'qa',
        strDbType: 'mssql',
        strHost: 'h',
        nPort: 1433,
        strDatabase: 'd',
        strUser: 'u',
        strPassword: 'p',
        bIsActive: true,
        dtCreatedAt: '',
        dtUpdatedAt: '',
      },
    ]);
    const objConn = fnResolveExecuteConnection(1, 'qa', 1);
    expect(objConn).toBeDefined();
    expect(objConn?.nId).toBe(1);
  });

  it('접속의 프로덕트와 불일치하면 undefined', () => {
    fnSeedConnections([
      {
        nId: 1,
        nProductId: 1,
        strProductName: 'P',
        strKind: 'GAME',
        strEnv: 'qa',
        strDbType: 'mssql',
        strHost: 'h',
        nPort: 1433,
        strDatabase: 'd',
        strUser: 'u',
        strPassword: 'p',
        bIsActive: true,
        dtCreatedAt: '',
        dtUpdatedAt: '',
      },
    ]);
    expect(fnResolveExecuteConnection(99999, 'qa', 1)).toBeUndefined();
  });
});
