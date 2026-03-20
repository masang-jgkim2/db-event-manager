import { fnResolveExecuteConnection } from '../data/dbConnections';

describe('fnResolveExecuteConnection', () => {
  it('nDbConnectionId 없으면 GAME 종류 활성 접속', () => {
    const objConn = fnResolveExecuteConnection(1, 'qa');
    expect(objConn).toBeDefined();
    expect(objConn?.strKind ?? 'GAME').toBe('GAME');
    expect(objConn?.nProductId).toBe(1);
    expect(objConn?.strEnv).toBe('qa');
    expect(objConn?.bIsActive).toBe(true);
  });

  it('nDbConnectionId 지정 시 동일 프로덕트·요청 env면 해당 접속', () => {
    const objConn = fnResolveExecuteConnection(1, 'qa', 1);
    expect(objConn).toBeDefined();
    expect(objConn?.nId).toBe(1);
  });

  it('접속의 프로덕트와 불일치하면 undefined', () => {
    expect(fnResolveExecuteConnection(99999, 'qa', 1)).toBeUndefined();
  });
});
