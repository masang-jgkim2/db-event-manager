import * as mssql from 'mssql';
import mysql from 'mysql2/promise';
import { IDbConnection, IQueryExecutionResult, IQueryPartResult } from '../types';
import { fnGetMssqlConnection, fnGetMysqlConnection, fnInvalidatePool } from '../db/dbManager';

// =============================================
// 멀티쿼리 파싱 (세미콜론 분리)
// 문자열/주석 내부의 세미콜론은 무시
// =============================================
export const fnParseQueries = (strRawQuery: string): string[] => {
  const arrQueries: string[] = [];
  let strCurrent = '';
  let bInSingleQuote = false;
  let bInDoubleQuote = false;
  let bInLineComment = false;
  let bInBlockComment = false;

  for (let i = 0; i < strRawQuery.length; i++) {
    const ch = strRawQuery[i];
    const chNext = strRawQuery[i + 1] || '';

    // 라인 주석 종료 (\n)
    if (bInLineComment) {
      if (ch === '\n') bInLineComment = false;
      strCurrent += ch;
      continue;
    }

    // 블록 주석 종료 (*/)
    if (bInBlockComment) {
      if (ch === '*' && chNext === '/') {
        bInBlockComment = false;
        strCurrent += '*/';
        i++;
      } else {
        strCurrent += ch;
      }
      continue;
    }

    // 작은따옴표 안 - 이스케이프('')도 처리
    if (bInSingleQuote) {
      strCurrent += ch;
      if (ch === "'" && chNext === "'") {
        strCurrent += "'";
        i++;
      } else if (ch === "'") {
        bInSingleQuote = false;
      }
      continue;
    }

    // 큰따옴표 안 (식별자용)
    if (bInDoubleQuote) {
      strCurrent += ch;
      if (ch === '"') bInDoubleQuote = false;
      continue;
    }

    // 라인 주석 시작 (--)
    if (ch === '-' && chNext === '-') {
      bInLineComment = true;
      strCurrent += '--';
      i++;
      continue;
    }

    // 블록 주석 시작 (/*)
    if (ch === '/' && chNext === '*') {
      bInBlockComment = true;
      strCurrent += '/*';
      i++;
      continue;
    }

    if (ch === "'") { bInSingleQuote = true; strCurrent += ch; continue; }
    if (ch === '"') { bInDoubleQuote = true; strCurrent += ch; continue; }

    // 세미콜론 → 쿼리 분리
    if (ch === ';') {
      const strTrimmed = strCurrent.trim();
      if (strTrimmed.length > 0) arrQueries.push(strTrimmed);
      strCurrent = '';
      continue;
    }

    strCurrent += ch;
  }

  // 마지막 쿼리 (세미콜론 없이 끝난 경우)
  const strTrimmed = strCurrent.trim();
  if (strTrimmed.length > 0) arrQueries.push(strTrimmed);

  return arrQueries.filter((q) => q.length > 0);
};

// =============================================
// MSSQL 트랜잭션 실행
// 여러 쿼리를 BEGIN TRAN...COMMIT 블록으로 래핑해 단일 배치로 전송.
// 프로파일러에서 1건으로 보이며 네트워크 왕복도 1회.
// =============================================
const fnExecuteMssql = async (
  objPool: mssql.ConnectionPool,
  arrQueries: string[]
): Promise<IQueryPartResult[]> => {
  // 단일 쿼리면 트랜잭션 래퍼 없이 그대로 실행 (불필요한 BEGIN TRAN 제거)
  const bNeedsTransaction = arrQueries.length > 1;

  // 모든 구문을 세미콜론으로 연결해 하나의 배치 문자열로 합침
  const strBatch = bNeedsTransaction
    ? `BEGIN TRAN\n${arrQueries.join(';\n')};\nCOMMIT`
    : arrQueries[0];

  const objRequest = new mssql.Request(objPool);

  try {
    const objResult = await objRequest.query(strBatch);

    // rowsAffected: 각 구문별 영향 행 수 배열 (e.g. [3, 5])
    // BEGIN TRAN / COMMIT 자체도 0으로 포함될 수 있으므로 arrQueries 길이 기준으로 매핑
    const arrRowsAffected = objResult.rowsAffected ?? [];

    return arrQueries.map((strQuery, i) => ({
      nIndex: i,
      strQuery,
      // BEGIN TRAN(0), 쿼리1(1), ..., COMMIT(마지막) 순서로 오므로
      // 트랜잭션 래퍼가 있으면 인덱스를 1씩 밀어서 읽음
      nAffectedRows: arrRowsAffected[bNeedsTransaction ? i + 1 : i] ?? 0,
    }));
  } catch (error) {
    // 단일 배치이므로 오류 발생 시 MSSQL이 자동 롤백(또는 명시적 ROLLBACK 전송)
    // BEGIN TRAN을 직접 붙인 경우 ROLLBACK으로 명시적 정리
    if (bNeedsTransaction) {
      try {
        await new mssql.Request(objPool).query('IF @@TRANCOUNT > 0 ROLLBACK');
      } catch { /* 연결 오류 시 무시 */ }
    }
    throw error;
  }
};

// =============================================
// MySQL 트랜잭션 실행
// =============================================
const fnExecuteMysql = async (
  objDbConn: mysql.PoolConnection,
  arrQueries: string[]
): Promise<IQueryPartResult[]> => {
  const arrResults: IQueryPartResult[] = [];

  await objDbConn.beginTransaction();
  try {
    for (let i = 0; i < arrQueries.length; i++) {
      const strQuery = arrQueries[i];
      const [objResult] = await objDbConn.execute<mysql.ResultSetHeader>(strQuery);

      arrResults.push({
        nIndex: i,
        strQuery,
        nAffectedRows: objResult.affectedRows ?? 0,
      });
    }
    await objDbConn.commit();
    return arrResults;
  } catch (error) {
    try { await objDbConn.rollback(); } catch { /* 롤백 실패 무시 */ }
    throw error;
  }
};

// =============================================
// 쿼리 실행 메인 함수
// =============================================
export const fnExecuteQuery = async (
  objConn: IDbConnection,
  strEnv: 'qa' | 'live'
): Promise<IQueryExecutionResult> => {
  const dtStart = Date.now();
  const dtExecutedAt = new Date().toISOString();

  // 쿼리가 없는 경우
  if (!objConn.strDatabase || !objConn.strHost) {
    return {
      bSuccess: false,
      strEnv,
      strExecutedQuery: '',
      arrQueryResults: [],
      nTotalAffectedRows: 0,
      nElapsedMs: 0,
      strError: 'DB 접속 정보가 유효하지 않습니다.',
      dtExecutedAt,
    };
  }

  return { bSuccess: false, strEnv, strExecutedQuery: '', arrQueryResults: [], nTotalAffectedRows: 0, nElapsedMs: 0, dtExecutedAt };
};

// =============================================
// 실제 쿼리 문자열과 접속 정보로 실행
// =============================================
export const fnExecuteQueryWithText = async (
  objConn: IDbConnection,
  strGeneratedQuery: string,
  strEnv: 'qa' | 'live'
): Promise<IQueryExecutionResult> => {
  const dtStart = Date.now();
  const dtExecutedAt = new Date().toISOString();
  const arrQueries = fnParseQueries(strGeneratedQuery);

  if (arrQueries.length === 0) {
    return {
      bSuccess: false,
      strEnv,
      strExecutedQuery: strGeneratedQuery,
      arrQueryResults: [],
      nTotalAffectedRows: 0,
      nElapsedMs: Date.now() - dtStart,
      strError: '실행할 쿼리가 없습니다. 쿼리 내용을 확인해주세요.',
      dtExecutedAt,
    };
  }

  try {
    let arrResults: IQueryPartResult[] = [];

    if (objConn.strDbType === 'mssql') {
      const objPool = await fnGetMssqlConnection(objConn);
      arrResults = await fnExecuteMssql(objPool, arrQueries);
    } else if (objConn.strDbType === 'mysql') {
      const objDbConn = await fnGetMysqlConnection(objConn);
      try {
        arrResults = await fnExecuteMysql(objDbConn, arrQueries);
      } finally {
        objDbConn.release();
      }
    } else {
      throw new Error('지원하지 않는 DB 타입입니다.');
    }

    const nTotalAffectedRows = arrResults.reduce((acc, r) => acc + r.nAffectedRows, 0);
    const nElapsedMs = Date.now() - dtStart;

    console.log(`[쿼리 실행] ${strEnv.toUpperCase()} | ${objConn.strProductName} | ${nTotalAffectedRows}건 | ${nElapsedMs}ms`);

    return {
      bSuccess: true,
      strEnv,
      strExecutedQuery: strGeneratedQuery,
      arrQueryResults: arrResults,
      nTotalAffectedRows,
      nElapsedMs,
      dtExecutedAt,
    };
  } catch (error: any) {
    const nElapsedMs = Date.now() - dtStart;
    const strErrorMsg = error?.message || String(error);

    // 오류 상세 로그: DB 종류별 오류 코드 + 쿼리 첫 줄 포함
    const strQueryPreview = strGeneratedQuery.split('\n')[0].trim().slice(0, 80);
    console.error(`[쿼리 실행 실패] ──────────────────────────────`);
    console.error(`  환경: ${strEnv.toUpperCase()} | 프로덕트: ${objConn.strProductName}`);
    console.error(`  DB: ${objConn.strDbType} | ${objConn.strHost}:${objConn.nPort}/${objConn.strDatabase}`);
    console.error(`  오류 코드: ${error?.code ?? error?.number ?? 'N/A'} | 상태: ${error?.state ?? 'N/A'}`);
    console.error(`  메시지: ${strErrorMsg}`);
    console.error(`  쿼리(첫 줄): ${strQueryPreview}`);
    console.error(`  소요: ${nElapsedMs}ms`);
    if (error?.stack) console.error(`  스택:\n${error.stack}`);
    console.error(`──────────────────────────────────────────`);

    // 연결 문제일 경우 풀 무효화 (재연결 유도)
    if (error?.code === 'ECONNRESET' || error?.code === 'ENOTOPEN' || error?.number === -2) {
      console.warn(`[쿼리 실행] 연결 오류 감지 — 커넥션 풀 무효화 (nId: ${objConn.nId})`);
      await fnInvalidatePool(objConn.nId);
    }

    // ── 오류 행 번호 → 실제 쿼리 내 위치로 변환 ─────────────────
    // MSSQL lineNumber는 실행된 배치 전체 기준이므로
    // BEGIN TRAN 래퍼 오프셋(1줄)과 각 쿼리의 누적 줄 수를 계산해
    // "몇 번째 쿼리 / 해당 쿼리 내 몇 번째 줄"로 변환한다.
    let strLineInfo: string | null = null;
    if (error?.lineNumber) {
      const nBatchLine: number = error.lineNumber;
      const bHasTran = arrQueries.length > 1;
      // BEGIN TRAN 줄이 1줄이므로 트랜잭션 래퍼가 있으면 -1 오프셋
      const nOffset = bHasTran ? 1 : 0;
      const nAdjusted = nBatchLine - nOffset;   // 쿼리 본문 기준 줄 번호

      // 각 쿼리의 줄 수 누적합으로 어느 쿼리에 해당하는지 찾기
      let nAccum = 0;
      let nQueryIdx = -1;
      let nLineInQuery = nAdjusted;
      for (let i = 0; i < arrQueries.length; i++) {
        const nLines = arrQueries[i].split('\n').length;
        // 쿼리 사이 세미콜론도 1줄로 간주 (배치 조립 시 ";\n" 추가)
        const nSepLines = bHasTran && i < arrQueries.length - 1 ? 1 : 0;
        if (nAdjusted <= nAccum + nLines) {
          nQueryIdx    = i;
          nLineInQuery = nAdjusted - nAccum;
          break;
        }
        nAccum += nLines + nSepLines;
      }

      if (nQueryIdx >= 0) {
        strLineInfo = `[쿼리 ${nQueryIdx + 1}번 / ${nLineInQuery}번째 줄]`;
      } else {
        strLineInfo = `[배치 ${nBatchLine}번째 줄]`;
      }
    }

    // 오류 메시지 사용자 친화적으로 가공
    // MSSQL 오류는 number/lineNumber/serverName 등 포함 가능
    const strUserError = [
      strErrorMsg,
      error?.number   ? `[SQL 오류 번호: ${error.number}]` : null,
      strLineInfo,
    ].filter(Boolean).join(' ');

    return {
      bSuccess: false,
      strEnv,
      strExecutedQuery: strGeneratedQuery,
      arrQueryResults: [],
      nTotalAffectedRows: 0,
      nElapsedMs,
      strError: strUserError,
      strRollbackMsg: '트랜잭션이 롤백되어 DB 변경 사항이 없습니다.',
      dtExecutedAt,
    };
  }
};
