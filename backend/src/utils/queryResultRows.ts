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

/** 행 반환 가능성이 있는 SQL(휴리스틱) */
export const fnIsLikelyRowReturningSql = (strSql: string): boolean =>
  /^\s*(SELECT|WITH|SHOW|DESCRIBE|DESC|EXEC|EXECUTE|PRAGMA)\b/is.test(strSql.trim());

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
