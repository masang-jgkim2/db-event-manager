import {
  fnBuildMssqlExecuteBatch,
  fnSqlHasOwnMssqlTransactionControl,
} from '../utils/mssqlSelfManagedTxn';

describe('fnSqlHasOwnMssqlTransactionControl', () => {
  it('BEGIN TRAN / BEGIN TRANSACTION / BEGIN TRY 감지', () => {
    expect(fnSqlHasOwnMssqlTransactionControl('BEGIN TRAN\nUPDATE t SET a=1')).toBe(true);
    expect(fnSqlHasOwnMssqlTransactionControl('BEGIN TRANSACTION\nCOMMIT')).toBe(true);
    expect(fnSqlHasOwnMssqlTransactionControl('BEGIN TRY\nSELECT 1\nEND TRY')).toBe(true);
  });

  it('일반 다중 DML은 false', () => {
    expect(fnSqlHasOwnMssqlTransactionControl('UPDATE t SET a=1; INSERT INTO t VALUES (1);')).toBe(false);
  });

  it('주석·문자열 안의 BEGIN TRAN 은 무시', () => {
    expect(fnSqlHasOwnMssqlTransactionControl('-- BEGIN TRAN\nUPDATE t SET a=1;')).toBe(false);
    expect(fnSqlHasOwnMssqlTransactionControl('/* BEGIN TRY */\nDELETE FROM t;')).toBe(false);
    expect(fnSqlHasOwnMssqlTransactionControl("SELECT 'BEGIN TRAN' AS x;")).toBe(false);
  });

  it('아이템 삭제 스크립트 패턴', () => {
    const strSql = `
DROP TABLE IF EXISTS ##__T;
BEGIN TRAN
BEGIN TRY
  DECLARE @IsCommit INT = 1;
  COMMIT TRAN
END TRY
BEGIN CATCH
  ROLLBACK TRAN
END CATCH
`;
    expect(fnSqlHasOwnMssqlTransactionControl(strSql)).toBe(true);
  });
});

describe('fnBuildMssqlExecuteBatch', () => {
  it('자체 TRAN이면 원문 그대로', () => {
    const strRaw = 'BEGIN TRAN\nUPDATE t SET a=1;\nCOMMIT';
    const obj = fnBuildMssqlExecuteBatch(['BEGIN TRAN', 'UPDATE t SET a=1', 'COMMIT'], strRaw, true);
    expect(obj.bWrappedTransaction).toBe(false);
    expect(obj.strBatch).toBe(strRaw);
    expect(obj.strBatch).not.toMatch(/^BEGIN TRAN\nBEGIN TRAN/);
  });

  it('일반 다중 구문은 BEGIN TRAN…COMMIT 래핑', () => {
    const obj = fnBuildMssqlExecuteBatch(
      ['UPDATE t SET a=1', 'INSERT INTO t VALUES (1)'],
      'UPDATE t SET a=1; INSERT INTO t VALUES (1);',
      false,
    );
    expect(obj.bWrappedTransaction).toBe(true);
    expect(obj.strBatch).toBe('BEGIN TRAN\nUPDATE t SET a=1;\nINSERT INTO t VALUES (1);\nCOMMIT');
  });

  it('단일 구문은 래핑 없음', () => {
    const obj = fnBuildMssqlExecuteBatch(['SELECT 1'], 'SELECT 1', false);
    expect(obj.bWrappedTransaction).toBe(false);
    expect(obj.strBatch).toBe('SELECT 1');
  });
});
