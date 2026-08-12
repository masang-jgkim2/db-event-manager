/**
 * MSSQL 스크립트가 스스로 트랜잭션/TRY를 관리하는지 판별.
 * DQPM 바깥 BEGIN TRAN…COMMIT 래핑과 충돌하는 템플릿 감지용.
 */

/** 주석·문자열 밖에서 BEGIN TRAN / BEGIN TRY 가 있으면 true */
export const fnSqlHasOwnMssqlTransactionControl = (strRawQuery: string): boolean => {
  let bInSingleQuote = false;
  let bInDoubleQuote = false;
  let bInLineComment = false;
  let bInBlockComment = false;

  for (let i = 0; i < strRawQuery.length; i++) {
    const ch = strRawQuery[i];
    const chNext = strRawQuery[i + 1] || '';

    if (bInLineComment) {
      if (ch === '\n') bInLineComment = false;
      continue;
    }
    if (bInBlockComment) {
      if (ch === '*' && chNext === '/') {
        bInBlockComment = false;
        i++;
      }
      continue;
    }
    if (bInSingleQuote) {
      if (ch === "'" && chNext === "'") {
        i++;
      } else if (ch === "'") {
        bInSingleQuote = false;
      }
      continue;
    }
    if (bInDoubleQuote) {
      if (ch === '"') bInDoubleQuote = false;
      continue;
    }

    if (ch === '-' && chNext === '-') {
      bInLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && chNext === '*') {
      bInBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'") {
      bInSingleQuote = true;
      continue;
    }
    if (ch === '"') {
      bInDoubleQuote = true;
      continue;
    }

    const bAtWordStart = i === 0 || !/[A-Za-z0-9_]/.test(strRawQuery[i - 1]);
    if (!bAtWordStart) continue;

    const strTail = strRawQuery.slice(i);
    if (/^BEGIN\s+TRAN(SACTION)?\b/i.test(strTail) || /^BEGIN\s+TRY\b/i.test(strTail)) {
      return true;
    }
  }

  return false;
};

/** MSSQL 실행 배치 조립 — 자체 TRAN/TRY 면 원문, 아니면 기존 래핑 */
export const fnBuildMssqlExecuteBatch = (
  arrQueries: string[],
  strRawQuery: string,
  bSelfManagedTxn: boolean,
): { strBatch: string; bWrappedTransaction: boolean } => {
  if (bSelfManagedTxn) {
    return { strBatch: strRawQuery, bWrappedTransaction: false };
  }
  if (arrQueries.length > 1) {
    return {
      strBatch: `BEGIN TRAN\n${arrQueries.join(';\n')};\nCOMMIT`,
      bWrappedTransaction: true,
    };
  }
  return { strBatch: arrQueries[0] ?? '', bWrappedTransaction: false };
};
