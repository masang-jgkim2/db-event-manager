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

/** Ant Design dataIndex="" 이면 행 객체 전체가 넘어가 [object Object] — 빈 이름은 표시용으로 치환 */
export const fnSafeResultColumnName = (strName: string, nIndex: number): string => {
  const strTrim = String(strName ?? '').trim();
  if (strTrim) return strTrim;
  return nIndex === 0 ? '(No column name)' : `(No column name ${nIndex + 1})`;
};

const fnDeduplicateColumnNames = (arrNames: string[]): string[] => {
  const mapCount = new Map<string, number>();
  return arrNames.map((strName) => {
    const nSeen = mapCount.get(strName) ?? 0;
    mapCount.set(strName, nSeen + 1);
    if (nSeen === 0) return strName;
    return `${strName} (${nSeen + 1})`;
  });
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

/**
 * MSSQL이 무명 컬럼을 빈 키로 합치며 배열로 넣는 경우 펼침 후
 * 빈 컬럼명을 (No column name)으로 정규화
 */
export const fnPackResultRows = (arrRaw: Record<string, unknown>[]): IPackedQueryResultSet => {
  const bResultTruncated = arrRaw.length > N_QUERY_RESULT_MAX_ROWS;
  const arrSlice = bResultTruncated ? arrRaw.slice(0, N_QUERY_RESULT_MAX_ROWS) : arrRaw;

  const arrNormalized = arrSlice.map((row) => {
    const objOut: Record<string, unknown> = {};
    let nAnon = 0;
    for (const [strKey, rawVal] of Object.entries(row)) {
      if (strKey === '' && Array.isArray(rawVal)) {
        for (const cell of rawVal) {
          objOut[fnSafeResultColumnName('', nAnon++)] = cell;
        }
        continue;
      }
      if (strKey === '') {
        objOut[fnSafeResultColumnName('', nAnon++)] = rawVal;
        continue;
      }
      objOut[strKey] = rawVal;
    }
    return objOut;
  });

  const setCols = new Set<string>();
  for (const row of arrNormalized) {
    for (const k of Object.keys(row)) setCols.add(k);
  }
  // 첫 행 키 순서 우선(무명 컬럼 펼친 순서 유지), 없으면 set 순회
  const arrOrderedCols =
    arrNormalized[0] && Object.keys(arrNormalized[0]).length > 0
      ? fnDeduplicateColumnNames(Object.keys(arrNormalized[0]))
      : fnDeduplicateColumnNames([...setCols]);

  const arrResultRows = arrNormalized.map((row) => {
    const objOut: Record<string, TQueryResultCell> = {};
    for (const col of arrOrderedCols) {
      objOut[col] = fnSerializeCell(row[col]);
    }
    return objOut;
  });
  return { arrResultRows, arrResultColumns: arrOrderedCols, bResultTruncated };
};
