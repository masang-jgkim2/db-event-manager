export type TDiffLineKind = 'same' | 'removed' | 'added';

export interface IDiffLine {
  strKind: TDiffLineKind;
  strLine: string;
  /** 수정 전 쿼리 기준 1-based 줄 번호 */
  nLineNoBefore?: number;
  /** 수정 후 쿼리 기준 1-based 줄 번호 */
  nLineNoAfter?: number;
}

/** 두 텍스트 줄 단위 LCS diff */
export const fnDiffTextLines = (strBefore: string, strAfter: string): IDiffLine[] => {
  const arrA = strBefore.replace(/\r\n/g, '\n').split('\n');
  const arrB = strAfter.replace(/\r\n/g, '\n').split('\n');
  const n = arrA.length;
  const m = arrB.length;
  const arrDp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      arrDp[i][j] = arrA[i - 1] === arrB[j - 1]
        ? arrDp[i - 1][j - 1] + 1
        : Math.max(arrDp[i - 1][j], arrDp[i][j - 1]);
    }
  }

  const arrOut: IDiffLine[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && arrA[i - 1] === arrB[j - 1]) {
      arrOut.push({
        strKind: 'same',
        strLine: arrA[i - 1],
        nLineNoBefore: i,
        nLineNoAfter: j,
      });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || arrDp[i][j - 1] >= arrDp[i - 1][j])) {
      arrOut.push({ strKind: 'added', strLine: arrB[j - 1], nLineNoAfter: j });
      j -= 1;
    } else {
      arrOut.push({ strKind: 'removed', strLine: arrA[i - 1], nLineNoBefore: i });
      i -= 1;
    }
  }
  return arrOut.reverse();
};

export const fnHasDiffChanges = (arrLines: IDiffLine[]): boolean =>
  arrLines.some((l) => l.strKind !== 'same');

/** 변경된 줄(삭제·추가)만 — 동일 줄 제외 */
export const fnDiffChangedLinesOnly = (strBefore: string, strAfter: string): IDiffLine[] =>
  fnDiffTextLines(strBefore, strAfter).filter((l) => l.strKind !== 'same');
