import {
  fnPackResultRows,
  fnIsLikelyRowReturningSql,
  fnCountLikelyRowReturningStatements,
  N_QUERY_RESULT_MAX_ROWS,
} from '../utils/queryResultRows';

describe('queryResultRows', () => {
  it('SELECT 패턴 인식', () => {
    expect(fnIsLikelyRowReturningSql('SELECT 1')).toBe(true);
    expect(fnIsLikelyRowReturningSql('  with cte as (select 1) select * from cte')).toBe(true);
    expect(fnIsLikelyRowReturningSql('UPDATE t SET a=1')).toBe(false);
  });

  it('USE/DECLARE로 시작하는 배치 본문의 SELECT·EXEC 인식', () => {
    expect(
      fnIsLikelyRowReturningSql(`USE [master]

SELECT @@VERSION`),
    ).toBe(true);
    expect(
      fnIsLikelyRowReturningSql(`DECLARE @x INT = 1
EXEC xp_ReadErrorLog 0, 1, N'error'`),
    ).toBe(true);
    expect(fnIsLikelyRowReturningSql('USE [master]')).toBe(false);
  });

  it('한 조각 안 SELECT/EXEC 개수 — 361번 2번째 배치', () => {
    const strPart2 = `DECLARE @YESTERDAY NVARCHAR(10) = CONVERT(NVARCHAR(10), DATEADD(DAY, -7, GETDATE()), 112)
DECLARE @TODAY NVARCHAR(10) = CONVERT(NVARCHAR(10), DATEADD(DAY, 1, GETDATE()), 112)
SELECT @YESTERDAY, @TODAY
EXEC xp_ReadErrorLog 0, 1, N'오류', NULL, @YESTERDAY, @TODAY, 'DESC'
EXEC xp_ReadErrorLog 0, 1, N'fail', NULL, @YESTERDAY, @TODAY, 'DESC'
EXEC xp_ReadErrorLog 0, 1, N'error', NULL, @YESTERDAY, @TODAY, 'DESC'
EXEC xp_ReadErrorLog 0, 1, N'memory', NULL, @YESTERDAY, @TODAY, 'DESC'
EXEC xp_ReadErrorLog 0, 1, N'deadlock', NULL, @YESTERDAY, @TODAY, 'DESC'
EXEC xp_ReadErrorLog 0, 1, N'non', NULL, @YESTERDAY, @TODAY, 'DESC'
--EXEC xp_ReadErrorLog 0, 1, NULL, NULL, @YESTERDAY, @TODAY, 'DESC'
EXEC xp_ReadErrorLog 0, 2, NULL, NULL, @YESTERDAY, @TODAY, 'DESC'
USE [msdb]
EXEC dbo.sp_help_jobhistory @start_run_date = @YESTERDAY, @end_run_date = @TODAY, @run_status = 0`;
    // SELECT 1 + EXEC 8 (필터6+Agent+Job, 주석 --EXEC 제외) = 9
    expect(fnCountLikelyRowReturningStatements(strPart2)).toBe(9);
  });

  it('행 패킹·열 수집·상한', () => {
    const arr = Array.from({ length: N_QUERY_RESULT_MAX_ROWS + 5 }, (_, i) => ({
      n_id: i,
      str_name: `u${i}`,
    }));
    const obj = fnPackResultRows(arr);
    expect(obj.arrResultRows).toHaveLength(N_QUERY_RESULT_MAX_ROWS);
    expect(obj.bResultTruncated).toBe(true);
    expect(obj.arrResultColumns).toContain('n_id');
    expect(obj.arrResultColumns).toContain('str_name');
  });

  it('무명 컬럼·배열 셀을 (No column name)으로 정규화', () => {
    const objVersion = fnPackResultRows([{ '': 'Microsoft SQL Server' }]);
    expect(objVersion.arrResultColumns).toEqual(['(No column name)']);
    expect(objVersion.arrResultRows[0]['(No column name)']).toBe('Microsoft SQL Server');

    const objDates = fnPackResultRows([{ '': ['20260728', '20260805'] }]);
    expect(objDates.arrResultColumns).toEqual(['(No column name)', '(No column name 2)']);
    expect(objDates.arrResultRows[0]['(No column name)']).toBe('20260728');
    expect(objDates.arrResultRows[0]['(No column name 2)']).toBe('20260805');
  });
});
