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
// =============================================
const fnExecuteMssql = async (
  objPool: mssql.ConnectionPool,
  arrQueries: string[]
): Promise<IQueryPartResult[]> => {
  const arrResults: IQueryPartResult[] = [];
  const transaction = new mssql.Transaction(objPool);

  await transaction.begin();
  try {
    for (let i = 0; i < arrQueries.length; i++) {
      const strQuery = arrQueries[i];
      const objRequest = new mssql.Request(transaction);
      const objResult = await objRequest.query(strQuery);

      arrResults.push({
        nIndex: i,
        strQuery,
        nAffectedRows: objResult.rowsAffected?.[0] ?? 0,
      });
    }
    await transaction.commit();
    return arrResults;
  } catch (error) {
    try { await transaction.rollback(); } catch { /* 롤백 실패 무시 */ }
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

    console.error(`[쿼리 실행 실패] ${strEnv.toUpperCase()} | ${objConn.strProductName} | ${strErrorMsg}`);

    // 연결 문제일 경우 풀 무효화
    if (error?.code === 'ECONNRESET' || error?.code === 'ENOTOPEN' || error?.number === -2) {
      await fnInvalidatePool(objConn.nId);
    }

    return {
      bSuccess: false,
      strEnv,
      strExecutedQuery: strGeneratedQuery,
      arrQueryResults: [],
      nTotalAffectedRows: 0,
      nElapsedMs,
      strError: strErrorMsg,
      strRollbackMsg: '트랜잭션이 롤백되어 DB 변경 사항이 없습니다.',
      dtExecutedAt,
    };
  }
};
