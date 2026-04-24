# 메타 데이터: JSON ↔ MySQL (`DATA_STORE`)

게임/이벤트 **실행 대상 DB**(MSSQL·MySQL 접속 정보)와 별개로, DQPM이 들고 있는 **앱 메타**(제품·템플릿·인스턴스·사용자·RBAC·활동 로그·UI 설정)를 저장하는 방식입니다.

## 환경 변수 (backend/.env)

| 변수 | 설명 |
|------|------|
| `DATA_STORE` | `json`(기본) 또는 `mysql` |
| `DATA_MYSQL_URL` | 우선 사용. 예: `mysql://user:pass@127.0.0.1:3306/dqpm_meta` |
| `DATA_MYSQL_HOST` / `DATA_MYSQL_PORT` / `DATA_MYSQL_USER` / `DATA_MYSQL_PASSWORD` / `DATA_MYSQL_DATABASE` | URL 없을 때 분리 설정 (`DATA_MYSQL_DATABASE` 필수) |
| `DATA_MYSQL_NO_JSON_IMPORT` | `1`이면 **빈 MySQL이어도** `data/*.json`에서 자동 적재하지 않음(빈 상태로 기동) |

## 동작 요약

- **`json`**: 기존과 동일 — `DATA_DIR`(기본 `backend/data`)의 `*.json` + 인메모리 배열.
- **`mysql`**:
  1. 기동 시 정규화 메타 테이블 생성([mysqlAppSchema.ts](../backend/src/db/mysqlAppSchema.ts) = [dqpm_meta_relational_schema.sql](./dqpm_meta_relational_schema.sql) 와 동일 구조).
  2. `product` 건수가 **0**이고 `DATA_MYSQL_NO_JSON_IMPORT`가 켜져 있지 않으면, `DATA_DIR`의 JSON을 **한 트랜잭션으로 적재**(부모→자식 FK 순서, [mysqlRelationalSync.ts](../backend/src/db/mysqlRelationalSync.ts)).
  3. MySQL에서 읽어 **인메모리 배열을 채움**(기존 컨트롤러 로직 유지).
  4. 이후 `fnSaveJson` 호출은 **파일 대신** 짧은 디바운스 후 **정규화 테이블 전체 스냅샷**(인메모리 → DB). `userUiPreferences`만 변경 시에는 `user_ui_preference`만 치환.
- **`userUiPreferences`**: MySQL 모드에서는 **인메모리 캐시 + `user_ui_preference`**(파일 미사용).

## 스키마

정규화 테이블·FK 정의는 [mysqlAppSchema.ts](../backend/src/db/mysqlAppSchema.ts) 및 동일 내용의 [dqpm_meta_relational_schema.sql](./dqpm_meta_relational_schema.sql) 참고. 예전 doc 전용 테이블(`dqpm_products` 등)이 DB에 남아 있으면 혼동만 되므로 제거 권장.

워크벤치·CLI에서 테이블을 볼 때는 **`DATA_MYSQL_DATABASE` 또는 `DATA_MYSQL_URL` 경로의 DB명**과 동일한 스키마를 선택해야 합니다(예: URL이 `…/3306/dqpm_meta`이면 다른 스키마와 혼동 주의). 기동 로그에 `[DATA_MYSQL] … | database=… | 메타테이블=…`가 출력됩니다.

## CLI: JSON만 MySQL에 넣기

DB는 이미 비어 있거나 덮어써도 될 때, 서버 없이 적재만 하려면 backend 디렉터리에서:

```bash
npm run import-json-to-mysql
```

`DATA_STORE`는 스크립트가 `mysql`로 설정합니다. 스키마 생성 후 `DATA_DIR` 기준 JSON을 메타 테이블에 반영합니다.

## 제한·주의

- **인메모리 캐시** 모델은 유지됩니다(요청 처리는 배열 기준). MySQL은 **영속화 + 기동 시 하이드레이트**입니다.
- **다중 백엔드 프로세스**가 동시에 같은 MySQL에 쓰면 마지막 저장이 이깁니다(단일 노드 가정).
- `seed_test.json`은 기존과 같이 **부팅 시 메모리만** 덮어씁니다(MySQL 자동 동기화는 이후 저장 시 반영).
- `docs/schema.sql`의 예전 통합 스키마(역할에 `arr_permissions` 등)와 **현재 JSON 정규화 모델**은 다릅니다. 메타 MySQL은 **`mysqlAppSchema.ts`**(테이블명 `product`, `users`, …)를 기준으로 합니다.

## 정규화 RDB 스키마

- [dqpm_meta_relational_schema.sql](./dqpm_meta_relational_schema.sql) — `DATA_STORE=mysql` 시 [mysqlAppSchema.ts](../backend/src/db/mysqlAppSchema.ts)와 동기. 적재·저장·하이드레이트는 [mysqlRelationalSync.ts](../backend/src/db/mysqlRelationalSync.ts).

## 관련 코드

- [dataStore.ts](../backend/src/data/dataStore.ts) — 모드 분기 (`DATA_STORE`)
- [jsonStore.ts](../backend/src/data/jsonStore.ts) — `fnLoadJson` / `fnSaveJson`에서 모드 처리
- [bootstrapDataStore.ts](../backend/src/data/bootstrapDataStore.ts) — 기동 시 스키마·임포트·하이드레이트
- [mysqlDocPersist.ts](../backend/src/db/mysqlDocPersist.ts) — 저장 디바운스
- [DATA-JSON-MAP.md](./DATA-JSON-MAP.md) — JSON 파일 ↔ 도메인
