import { fnPackResultRows, fnIsLikelyRowReturningSql, N_QUERY_RESULT_MAX_ROWS } from '../utils/queryResultRows';

describe('queryResultRows', () => {
  it('SELECT 패턴 인식', () => {
    expect(fnIsLikelyRowReturningSql('SELECT 1')).toBe(true);
    expect(fnIsLikelyRowReturningSql('  with cte as (select 1) select * from cte')).toBe(true);
    expect(fnIsLikelyRowReturningSql('UPDATE t SET a=1')).toBe(false);
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
});
