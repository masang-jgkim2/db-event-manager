/** SELECT 등 결과셋 — 이력·UI 저장용 (행 수·크기 제한) */
export const N_QUERY_RESULT_MAX_ROWS = 100;

export type TQueryResultCell = string | number | boolean | null;

export interface IPackedQueryResultSet {
  arrResultRows: Record<string, TQueryResultCell>[];
  arrResultColumns: string[];
  bResultTruncated: boolean;
}

const fnSerializeCell = (v: unknown): TQueryResultCell => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) return '[Binary]';
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  return String(v);
};

/** 행 반환 가능성이 있는 SQL(휴리스틱) — USE/DECLARE 등으로 시작하는 배치 본문의 SELECT·EXEC 포함 */
export const fnIsLikelyRowReturningSql = (strSql: string): boolean =>
  fnCountLikelyRowReturningStatements(strSql) > 0;

/**
 * 배치 안 SELECT/EXEC 등 개수 — MSSQL recordset 커서와 1:1로 맞춤
 * (주석 줄 `--EXEC`·정렬 `'DESC'` 는 미포함 — DESC 단독 토큰 제외)
 */
export const fnCountLikelyRowReturningStatements = (strSql: string): number => {
  const re = /(?:^|[\n;])\s*(SELECT|WITH|SHOW|DESCRIBE|EXEC|EXECUTE|PRAGMA)\b/gi;
  let n = 0;
  while (re.exec(strSql) !== null) n += 1;
  return n;
};

export const fnPackResultRows = (arrRaw: Record<string, unknown>[]): IPackedQueryResultSet => {
  const bResultTruncated = arrRaw.length > N_QUERY_RESULT_MAX_ROWS;
  const arrSlice = bResultTruncated ? arrRaw.slice(0, N_QUERY_RESULT_MAX_ROWS) : arrRaw;
  const setCols = new Set<string>();
  for (const row of arrSlice) {
    for (const k of Object.keys(row)) setCols.add(k);
  }
  const arrResultColumns = [...setCols];
  const arrResultRows = arrSlice.map((row) => {
    const objOut: Record<string, TQueryResultCell> = {};
    for (const col of arrResultColumns) {
      objOut[col] = fnSerializeCell(row[col]);
    }
    return objOut;
  });
  return { arrResultRows, arrResultColumns, bResultTruncated };
};
