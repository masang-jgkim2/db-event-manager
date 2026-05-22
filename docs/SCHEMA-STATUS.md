# 스키마·인메모리 반영 상태

> 제안 스키마 저장 여부 및 인메모리/로직 협응 상태 정리 (2026-03-10)

---

## 1. 제안 스키마 저장 상태

| 항목 | 상태 | 위치 |
|------|------|------|
| **정규화 스키마 (제안)** | 저장됨 | `docs/schema_normalized.sql` |
| **기존 스키마 (코드와 매핑 반영)** | 저장됨 | `docs/schema.sql` |
| **정규화 제안·매핑 문서** | 저장됨 | `docs/SCHEMA-NORMALIZATION-PROPOSAL.md` (섹션 7: 인메모리·코드 매핑) |

---

## 2. 인메모리·로직 협응 상태: **미반영**

**현재 코드는 정규화 스키마와 동일한 구조가 아니다.**  
인메모리는 여전히 “엔티티 안에 JSON/배열 내장” 방식이고, 정규화 스키마는 “별도 테이블로 분리” 방식이다.

### 2.1 현재 인메모리 구조 (코드 기준)

| 영역 | 현재 구조 | 정규화 스키마와 동일한가 |
|------|-----------|---------------------------|
| **역할** | `data/roles.ts`: `IRole[]`, 각 역할에 `arrPermissions: string[]` 내장 | 아니오 → 스키마는 `role_permissions` 별도 테이블 |
| **사용자** | `data/users.ts`: `IUser[]`, 각 사용자에 `arrRoles: string[]` 내장 | 아니오 → 스키마는 `user_roles` 별도 테이블 |
| **프로덕트** | `data/products.ts`: `IProduct[]`, 각 프로덕트에 `arrServices: IService[]` 내장 | 아니오 → 스키마는 `product_services` 별도 테이블 |
| **이벤트 인스턴스** | `data/eventInstances.ts`: `IEventInstance[]`, 각 인스턴스에 `arrDeployScope`, `arrStatusLogs`, `objCreator`~`objLiveVerifier` 내장 | 아니오 → 스키마는 `instance_deploy_scopes`, `instance_status_logs`, 처리자 FK 컬럼 등으로 분리 |
| **감사 로그** | 없음 (어디에도 배열/파일 없음) | 아니오 → 스키마는 `audit_logs` 테이블 |

### 2.2 정리

- **제안 스키마**: `schema_normalized.sql`에 잘 저장되어 있음.
- **동일한 구조의 인메모리**: 없음. roles/users/products/eventInstances는 여전히 “한 엔티티 = 한 객체 + 내장 배열/객체” 구조.
- **그에 협응하는 로직**: 미반영. Controller는 `arrStatusLogs.push`, `objInstance.objQaDeployer = objActor`, `arrRoles`, `arrPermissions` 등 **현재 인메모리 구조**에 맞춰 동작함.

---

## 3. 정규화 구조를 인메모리에 반영하려면

정규화 스키마와 **동일한 구조**를 인메모리에도 두고, 그에 **협응하는 로직**을 넣으려면 아래와 같은 변경이 필요함.

1. **데이터 레이어**
   - `role_permissions`, `user_roles`, `product_services`, `instance_deploy_scopes`, `instance_status_logs`, `instance_execution_results`, `execution_query_parts`, `audit_logs`에 대응하는 **별도 배열/저장소** 추가 (또는 JSON 파일 분리).
   - roles/users/products/eventInstances는 “분리된 테이블”만 참조하고, `arrPermissions` 등 내장 배열은 제거하거나 “조회 시 조립”용으로만 사용.

2. **조회 로직**
   - API 응답 시 위 저장소들을 조인해 `IProduct`, `IUser`, `IRole`, `IEventInstance` 등 **기존 타입**으로 조립 (SCHEMA-NORMALIZATION-PROPOSAL.md 7.2·7.3 참고).

3. **저장 로직**
   - 생성/수정/삭제 시 “한 엔티티 한 번 저장”이 아니라, **정규화된 여러 저장소에 나누어 쓰는** 로직으로 Controller/서비스 수정 (동일 문서 7.4 참고).

4. **audit_logs**
   - CRUD/로그인·로그아웃 등에서 `audit_logs`에 해당하는 배열에 1건씩 push하는 로직 추가.

이 작업은 **DB 전환 전에 인메모리를 정규화 스키마와 동일하게 맞추는 리팩터링**이며, 원하면 단계별로 진행할 수 있음.

---

## 4. 요약

| 질문 | 답 |
|------|----|
| 제안 스키마는 잘 저장해 두었는가? | 예. `docs/schema_normalized.sql`에 저장됨. |
| 동일한 구조를 가진 인메모리가 있는가? | 아니오. 인메모리는 여전히 내장 배열/객체 구조. |
| 그에 협응하는 로직이 반영된 상태인가? | 아니오. Controller/데이터 레이어는 현재(비정규화) 구조 기준으로 동작함. |

정규화 스키마는 “DB 전환 시 적용할 목표 DDL” 및 “전환 시 매핑/조립 방법을 정리한 문서”로 잘 보존되어 있고, **인메모리를 같은 구조로 바꾸고 로직을 맞추는 작업은 아직 하지 않은 상태**이다.
