# MySQL 쿼리 실행 로직 분석

> 작성일: 2026-03-10  
> 목적: QA/LIVE 반영 시 실제로 MySQL 쿼리가 어떻게 실행되는지 흐름 정리 및 사용 가능 여부 판단

---

## 1. 요약 결론

- **MySQL 쿼리 실행 로직은 사용 가능하다.**  
  이벤트 인스턴스의 `strGeneratedQuery`를 DB 접속 정보(프로덕트·환경)에 맞춰 **트랜잭션 안에서 한 문장씩 실행**하고, 실패 시 롤백·에러 반환까지 구현되어 있음.
- **실제 진입점**은 `fnExecuteQueryWithText` 하나뿐이며, `fnExecuteQuery`는 현재 **미사용 스텁**이다.

---

## 2. 전체 흐름 (호출 경로)

```
[클라이언트]
  POST /api/event-instances/:id/execute
  Body: { strEnv: 'qa' | 'live' }

  ↓

[eventInstanceController.fnExecuteAndDeploy]
  - 권한 검사 (my_dashboard.execute_qa / execute_live 등)
  - 인스턴스 조회, 상태 검사 (qa_requested / live_requested)
  - DEV 직접 실행 차단, 반영 범위( arrDeployScope ) 검사
  - 반영 날짜 검사 (LIVE는 dtDeployDate 이후만)
  - fnFindActiveConnection(nProductId, strEnv) → IDbConnection
  - fnExecuteQueryWithText(objDbConn, objInstance.strGeneratedQuery, strEnv)

  ↓

[queryExecutor.fnExecuteQueryWithText]
  - fnParseQueries(strGeneratedQuery) → 세미콜론으로 분리(문자열/주석 내 ; 제외)
  - objConn.strDbType === 'mysql' 인 경우:
    - fnGetMysqlConnection(objConn) → PoolConnection (pool.getConnection)
    - fnExecuteMysql(conn, arrQueries) → beginTransaction → 쿼리별 execute → commit (실패 시 rollback)
    - conn.release()
  - 결과를 IQueryExecutionResult 로 반환

  ↓

[eventInstanceController]
  - bSuccess 이면 인스턴스 상태 전이 + 처리자 기록 + SSE 브로드캐스트
  - 실패 시 상태 변경 없이 실행 결과(에러 메시지 등)만 반환
```

---

## 3. MySQL 관련 구현 상세

### 3.1 DB 연결 (backend/src/db/dbManager.ts)

- **드라이버**: `mysql2/promise` (package.json: `"mysql2": "^3.19.1"`).
- **풀 설정**:
  - `createPool({ host, port, database, user, password, connectionLimit: 5, connectTimeout: 10000, multipleStatements: false })`
  - `multipleStatements: false` → 한 번에 여러 문장을 보내지 않음. 멀티 쿼리는 파싱 후 **한 문장씩** 실행하는 현재 방식과 맞음.
- **연결 획득**: `fnGetMysqlConnection(objConn)` → `pool.getConnection()` 으로 `PoolConnection` 반환. 쿼리 실행 후 호출 측에서 `release()` 호출.

### 3.2 멀티 쿼리 파싱 (backend/src/services/queryExecutor.ts — fnParseQueries)

- **역할**: `strGeneratedQuery` 를 **세미콜론(;)** 기준으로 여러 개의 단일 쿼리로 나눔.
- **예외 처리**:
  - 문자열 안의 `;` (작은따옴표 `'...'`, 큰따옴표 `"..."`) 는 무시.
  - 라인 주석 `--`, 블록 주석 `/* ... */` 안의 `;` 도 무시.
- **결과**: `string[]` — 각 요소는 실행할 한 문장. 빈 문자열은 제외.

### 3.3 MySQL 트랜잭션 실행 (fnExecuteMysql)

- `objDbConn.beginTransaction()` 으로 트랜잭션 시작.
- `arrQueries` 를 **순서대로** 한 문장씩:
  - `await objDbConn.execute<mysql.ResultSetHeader>(strQuery)`
  - `objResult.affectedRows` 로 영향 행 수 수집 → `IQueryPartResult` 배열에 누적.
- **전부 성공** 시 `objDbConn.commit()`.
- **한 문장이라도 실패** 시 `objDbConn.rollback()` 후 같은 에러를 다시 throw.
- `fnExecuteQueryWithText` 쪽에서 `finally` 로 `objDbConn.release()` 호출 → 연결 반환.

즉, MySQL 경로는 **트랜잭션 + 문장 단위 실행 + 롤백/에러 처리 + 연결 반환**까지 갖춰져 있어 **사용 가능**하다.

### 3.4 에러 처리 및 풀 무효화

- 실행 중 예외 발생 시:
  - `IQueryExecutionResult` 에 `bSuccess: false`, `strError` 등 담아 반환.
  - `ECONNRESET`, `ENOTOPEN` 등 연결 오류 시 `fnInvalidatePool(objConn.nId)` 로 해당 접속 정보의 풀을 지우고, 다음 요청에서 재연결하도록 함.

---

## 4. MSSQL과의 차이 (참고)

- **MSSQL**: 여러 쿼리를 `BEGIN TRAN` + `쿼리1; 쿼리2; ...` + `COMMIT` 한 배치로 보내고, `rowsAffected` 배열로 구문별 영향 행 수를 매핑.
- **MySQL**: 위처럼 **문장 단위로 나눈 뒤** `beginTransaction` → 루프에서 `execute(한 문장)` → `commit` / `rollback`.  
  → 두 경로 모두 **멀티 문장 + 트랜잭션**을 지원하며, MySQL 경로는 현재 구조로 **그대로 사용 가능**하다.

---

## 5. 사용하지 않는 코드 (fnExecuteQuery)

- `queryExecutor.ts` 의 **fnExecuteQuery** (인자: `objConn`, `strEnv` 만 받는 버전)는:
  - 접속 정보 유효성만 검사한 뒤, **항상** `bSuccess: false` 인 결과만 반환하고 끝남.
  - 실제 DB 호출이나 `fnExecuteMssql` / `fnExecuteMysql` 호출이 없음.
  - 코드베이스에서 **어디서도 사용하지 않음** (호출처는 `fnExecuteQueryWithText` 만 존재).
- **정리**: 현재 동작에는 영향 없음. 제거해도 되고, 나중에 “쿼리 없이 연결만 검증” 용도로 쓰려면 구현을 보완해야 함.

---

## 6. DB 접속 정보의 유효 조건

- **실행에 사용되는 접속 정보**는 **데이터 소스** `arrDbConnections` (또는 dbConnections.json) 에서:
  - `fnFindActiveConnection(nProductId, strEnv)` 로 **nProductId + strEnv(dev/qa/live) 일치 + bIsActive === true** 인 한 건을 선택.
- **타입**: `IDbConnection` 에 `strDbType: 'mssql' | 'mysql'` 이 있으므로, **MySQL** 인 접속 정보면 위 흐름대로 `mysql2` 풀과 `fnExecuteMysql` 이 사용됨.

---

## 7. 결론 표

| 항목 | 상태 |
|------|------|
| MySQL 쿼리 실행 경로 | ✅ 구현됨, 트랜잭션·롤백·에러 처리·연결 반환 모두 처리 |
| 멀티 쿼리(세미콜론 분리) | ✅ fnParseQueries 로 문자열/주석 고려 분리 후 문장별 실행 |
| 사용 진입점 | ✅ fnExecuteQueryWithText 만 사용 (이벤트 실행 시) |
| fnExecuteQuery | ⚠️ 미사용 스텁, 실제 실행 없음 |

**최종**: MySQL 쿼리 실행 로직은 **그대로 사용 가능**하다. 게임 서버 업다운·UI 커스텀은 보류하고, 현재 QA/LIVE 반영 플로우에서는 MySQL 접속 정보만 올바르게 등록되어 있으면 정상 동작한다.
