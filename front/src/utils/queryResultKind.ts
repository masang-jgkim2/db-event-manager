import type { IQueryPartResult } from '../types';

/**
 * 행 반환 SQL 휴리스틱 — 백엔드 queryResultRows 와 동일 취지 + 변수대입/INTO 제외.
 * SELECT 0행은 arrResultRows 가 비어 «처리»로 오인될 수 있어 SQL로 보완.
 */
export const fnIsLikelyRowReturningSql = (strSql: string): boolean => {
  const re = /(?:^|[\n;])\s*(SELECT|WITH|SHOW|DESCRIBE|EXEC|EXECUTE|PRAGMA)\b/gi;
  let objMatch: RegExpExecArray | null;
  while ((objMatch = re.exec(strSql)) !== null) {
    const strKw = objMatch[1].toUpperCase();
    const nKwEnd = objMatch.index + objMatch[0].length;
    const strTail = strSql.slice(nKwEnd, nKwEnd + 500);
    if (strKw === 'SELECT') {
      // SELECT @x = … / SELECT @x := … — 결과셋 없음
      if (/^\s*@/.test(strTail)) continue;
      const strBeforeFrom = strTail.split(/\bFROM\b/i)[0] ?? strTail;
      // SELECT … INTO #tmp — recordset 없음
      if (/\bINTO\b/i.test(strBeforeFrom)) continue;
    }
    return true;
  }
  return false;
};

/** 조회(결과셋) vs 처리(DML·변수대입 등) */
export const fnIsQueryPartLookup = (r: IQueryPartResult): boolean => {
  const nResultRows = r.arrResultRows?.length ?? 0;
  if (nResultRows > 0) return true;
  if ((r.arrResultColumns?.length ?? 0) > 0) return true;
  return fnIsLikelyRowReturningSql(r.strQuery ?? '');
};

/** 타입별 1-based 번호 — Collapse 라벨 `#N`용 */
export const fnBuildQueryPartKindIndexMaps = (
  arrParts: IQueryPartResult[],
): { mapLookupIdx: Map<number, number>; mapProcessIdx: Map<number, number> } => {
  const mapLookupIdx = new Map<number, number>();
  const mapProcessIdx = new Map<number, number>();
  let nLookup = 0;
  let nProcess = 0;
  for (const r of arrParts) {
    if (fnIsQueryPartLookup(r)) {
      nLookup += 1;
      mapLookupIdx.set(r.nIndex, nLookup);
    } else {
      nProcess += 1;
      mapProcessIdx.set(r.nIndex, nProcess);
    }
  }
  return { mapLookupIdx, mapProcessIdx };
};
