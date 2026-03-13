# 검토: 메뉴 재구성(사용자·역할 상향) 및 서버 업다운 기능

> 작성일: 2026-03-10  
> 목적: 현재 DB 패치 위주 구조에서 (1) 사용자·역할 메뉴 상향, (2) 서버(Windows/Linux/애플리케이션) 업다운 기능 추가 검토

---

## 1. 현재 구조 요약

### 1.1 메뉴 순서 (MainLayout.tsx 기준)

| 순서 | 그룹   | 메뉴 항목           | 비고                    |
|------|--------|---------------------|-------------------------|
| 1    | **이벤트** | 대시보드            | 관리자 대시보드         |
| 2    | 이벤트 | 프로덕트            | 게임/서비스 단위        |
| 3    | 이벤트 | 이벤트 템플릿       | 쿼리 템플릿             |
| 4    | 이벤트 | DB 접속 정보        | dev/qa/live 접속 설정   |
| 5    | **사용자** | 사용자             | 계정 CRUD·비밀번호 초기화 |
| 6    | 사용자 | 역할 권한           | 역할·권한 매트릭스      |
| 7    | **운영**  | 나의 대시보드      | 이벤트 인스턴스 처리    |
| 8    | 운영   | 이벤트 생성         | 쿼리 작성·제출          |

- **특징**: “이벤트(프로덕트·템플릿·DB)”가 먼저 오고, 그 다음 “사용자·역할”, 마지막이 “운영(나의 대시보드·이벤트 생성)”. DB 패치/쿼리 실행 흐름이 메인인 구조.

### 1.2 그룹별 아이콘 추천 (Ant Design Icons, Outlined)

메뉴 **그룹 라벨** 옆에 쓸 수 있는 대표 아이콘 추천입니다. `@ant-design/icons` 기준.

| 그룹 | 추천 아이콘 | import | 비고 |
|------|-------------|--------|------|
| **이벤트** | `CalendarOutlined` | `CalendarOutlined` | 일정·이벤트·템플릿 느낌. 하위에 이벤트 템플릿에서도 사용 중. |
| | `ProjectOutlined` | `ProjectOutlined` | 프로젝트/구성 단위. 대안용. |
| | `AppstoreOutlined` | `AppstoreOutlined` | 앱/프로덕트 단위. 대안용. |
| **사용자** | `TeamOutlined` | `TeamOutlined` | 팀·여러 사용자. 사용자+역할 그룹핑에 적합. |
| | `UserOutlined` | `UserOutlined` | 단일 사용자. 단순한 대안. |
| | `IdcardOutlined` | `IdcardOutlined` | 신분/역할. 대안용. |
| **운영** | `RocketOutlined` | `RocketOutlined` | 발사/실행·배포. 운영·실행 느낌. |
| | `ThunderboltOutlined` | `ThunderboltOutlined` | 빠른 실행. 대안용. |
| | `PlayCircleOutlined` | `PlayCircleOutlined` | 재생/실행. 대안용. |

- **채택 예시**: 이벤트 → `CalendarOutlined`, 사용자 → `TeamOutlined`, 운영 → `RocketOutlined`.

### 1.3 라우트 순서 (App.tsx)

- `/` → `/products` → `/events` → `/users` → `/db-connections` → `/roles` → `/my-dashboard` → `/query`
- 라우트 선언 순서는 메뉴와 동일하게 이벤트·DB 관련이 앞에 옴.

---

## 2. 그룹 라벨에 아이콘 넣기 (구현)

Ant Design `Menu`의 그룹 `label`에 React 노드를 주면 그룹명 옆에 아이콘을 표시할 수 있습니다.

```tsx
// 예: 이벤트 그룹
{
  key: 'event-group',
  label: (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <CalendarOutlined /> 이벤트
    </span>
  ),
  type: 'group',
  children: arrEventChildren,
}
```

- 그룹별로 위 표의 추천 아이콘을 넣으면 됨 (이벤트: CalendarOutlined, 사용자: TeamOutlined, 운영: RocketOutlined).

---

## 3. 사용자·역할을 위로 올리기

### 3.1 제안 메뉴 순서

**옵션 A – “설정/관리”를 최상단**

| 순서 | 그룹       | 메뉴           |
|------|------------|----------------|
| 1    | **설정/관리** | 대시보드       |
| 2    | 설정/관리  | 사용자         |
| 3    | 설정/관리  | 역할 권한      |
| 4    | **이벤트**   | 프로덕트       |
| 5    | 이벤트     | 이벤트 템플릿  |
| 6    | 이벤트     | DB 접속 정보   |
| 7    | **운영**    | 나의 대시보드  |
| 8    | 운영       | 이벤트 생성    |

**옵션 B – 대시보드만 맨 위, 그 다음 사용자·역할**

| 순서 | 그룹   | 메뉴           |
|------|--------|----------------|
| 1    | (단일) | 대시보드       |
| 2    | **관리** | 사용자         |
| 3    | 관리   | 역할 권한      |
| 4    | **이벤트** | 프로덕트    |
| 5    | 이벤트 | 이벤트 템플릿  |
| 6    | 이벤트 | DB 접속 정보   |
| 7    | **운영** | 나의 대시보드 |
| 8    | 운영   | 이벤트 생성    |

- 공통: **사용자·역할**을 “이벤트(프로덕트/템플릿/DB)”보다 **위**로 올려, “먼저 설정하고 나서 이벤트·DB 작업” 흐름으로 정리.

### 3.2 수정 포인트 (구현 시)

- **프론트**
  - `front/src/components/MainLayout.tsx`: `arrMenuItems` 생성 시 그룹 순서·항목 순서 변경 (사용자 그룹을 이벤트 그룹보다 먼저 push).
  - `front/src/App.tsx`: 라우트 순서는 UX만 영향(탭 순서 등). 필요 시 `/users`, `/roles`를 `/products` 앞으로 옮겨도 됨(선택).
- **문서**
  - `docs/PERMISSION-MENU-ACTION-MATRIX.md`, `docs/SPEC.md` 등에 “메뉴 순서: 설정(사용자·역할) → 이벤트 → 운영” 명시.

### 3.3 권한·라우트

- 사용자·역할 메뉴/라우트는 그대로 `user.view`, `role.view` 등 기존 권한 사용. **권한 체계 변경 없음.**

---

## 4. 서버(Windows, Linux, 애플리케이션) 업다운 기능

### 4.1 “업다운” 정의 (가정)

- **업(Up)**: 서버 또는 애플리케이션 **기동/시작**
- **다운(Down)**: 서버 또는 애플리케이션 **중지/종료**
- 관리 대상:
  - **서버(Host)**: Windows 서버, Linux 서버 (OS 단위)
  - **애플리케이션**: 해당 서버 위에서 돌아가는 프로세스/서비스 (예: 게임 서버, API 서버, 배치)

### 4.2 도메인 모델 제안

```
[서버 Server]
  - nId, strName, strOsType (windows | linux), strHost (IP 또는 호스트명)
  - strAuthType (ssh_key | password | winrm)
  - 접속 정보(포트, 사용자, 비밀번호/키 경로 등) — 보안 저장 권장
  - bIsActive

[애플리케이션 Application] (서버에 소속)
  - nId, nServerId, strName, strDescription
  - strType (process | service | systemd)
  - strStartCommand, strStopCommand (또는 스크립트 경로)
  - Windows: 서비스명 또는 프로세스명
  - Linux: systemd unit명 또는 셸 명령
  - bIsActive
```

- **업다운 동작**: “애플리케이션” 단위로 **시작/중지** 버튼 → 백엔드가 해당 서버에 접속해 `strStartCommand` / `strStopCommand` 실행 (또는 systemd/service 제어).
- **서버만** 다루는 경우: “서버” 엔티티만 두고, 서버 단위 Up/Down(예: 재부팅)은 별도 액션으로 확장 가능.

### 4.3 기술적 접근 (실행 방식)

| 방식 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **SSH (Linux)** | Node에서 `ssh2` 등으로 SSH 접속 후 명령 실행 | 구현 단순, 널리 사용 | 방화벽·키 관리 필요 |
| **WinRM (Windows)** | WinRM으로 원격 PowerShell/명령 실행 | Windows 표준 원격 제어 | 설정·방화벽 필요 |
| **에이전트** | 각 서버에 소형 에이전트 설치, 백엔드가 에이전트에 HTTP로 “시작/중지” 지시 | 방화벽 유리, 보안 정책에 유연 | 에이전트 개발·배포·버전 관리 필요 |

- **1차 제안**: Linux는 SSH, Windows는 WinRM 또는 SSH(OpenSSH 설치 시). 에이전트는 요구사항·운영 부담 보고 2단계로 검토.

### 4.4 API·권한 제안

- **메뉴**: “서버 관리” 또는 “인프라” 그룹 추가  
  - 예: **서버** (목록·상세), **애플리케이션** (목록·상세·업/다운 버튼)
- **권한**:  
  - `server.view` (서버·앱 목록/상세 보기)  
  - `server.start` (업), `server.stop` (다운)  
  - 필요 시 `server.create`, `server.edit`, `server.delete` (서버/앱 등록·수정·삭제)
- **API 예시**:
  - `GET/POST/PUT/DELETE /api/servers`
  - `GET/POST/PUT/DELETE /api/servers/:id/applications`
  - `POST /api/servers/:serverId/applications/:appId/start` (업)  
  - `POST /api/servers/:serverId/applications/:appId/stop` (다운)  
  - 필요 시 상태 조회: `GET .../applications/:appId/status`

### 4.5 UI 배치 제안

- **메뉴 순서 (옵션 A 반영 + 서버 추가)**  
  1. 설정/관리: 대시보드, 사용자, 역할 권한  
  2. 이벤트: 프로덕트, 이벤트 템플릿, DB 접속 정보  
  3. **인프라(또는 서버)**: 서버 목록 (→ 서버별 애플리케이션 목록 → 업/다운 버튼)  
  4. 운영: 나의 대시보드, 이벤트 생성  

- **페이지**:  
  - `ServerPage.tsx`: 서버 목록, 서버 추가/수정/삭제, 서버 선택 시 해당 서버의 애플리케이션 목록.  
  - 애플리케이션 행에 “시작(Up)” / “중지(Down)” 버튼, 상태(실행 중/중지됨) 표시.  
  - 실행 전 확인 모달(경고 문구) 권장.

### 4.6 보안·운영 고려

- 서버/앱 접속 정보(비밀번호, 키)는 암호화 저장, API에서는 마스킹 노출.  
- Up/Down은 **감사 로그** 기록(누가, 언제, 어떤 서버/앱에 수행).  
- 권한은 최소 권한 원칙: `server.start`/`server.stop`만 부여 가능하도록.  
- 네트워크: 백엔드 ↔ 대상 서버(SSH/WinRM) 방화벽·VPC 정책 확인.

### 4.7 DB 스키마 예시 (추가 시)

- `servers`: n_id, str_name, str_os_type, str_host, n_port, str_auth_type, str_user, str_password_encrypted, b_is_active, dt_created_at, dt_updated_at  
- `applications`: n_id, n_server_id, str_name, str_type, str_start_command, str_stop_command, str_status_check_command, b_is_active, dt_created_at, dt_updated_at  
- `server_audit_log`: n_id, n_user_id, n_server_id, n_application_id, str_action (start|stop), dt_created_at  

---

## 5. 적용 순서 제안

1. **1단계 (변경 최소)**  
   - 메뉴만 재구성: 사용자·역할을 이벤트 그룹 위로 올리기 (MainLayout.tsx 수정).  
   - 라우트/권한/백엔드 변경 없이 진행 가능.

2. **2단계 (서버 업다운)**  
   - 도메인·API·권한 확정 후  
     - 백엔드: `servers`, `applications` 데이터/스키마, 라우트, 실행 로직(SSH/WinRM 등).  
     - 프론트: ServerPage, 서버/앱 목록, Up/Down 버튼 및 상태 표시.  
   - 메뉴에 “서버(또는 인프라)” 그룹 추가.

3. **3단계 (선택)**  
   - 감사 로그, 상태 폴링/SSE, 에이전트 방식 등 확장.

---

## 6. 요약

| 항목 | 내용 |
|------|------|
| **사용자·역할 상향** | 메뉴에서 “사용자” 그룹(사용자, 역할 권한)을 “이벤트” 그룹보다 위로 배치. MainLayout.tsx 그룹 순서만 변경하면 됨. |
| **서버 업다운** | 서버(Windows/Linux) + 애플리케이션(프로세스/서비스) 엔티티 추가, 시작/중지 API·UI, SSH/WinRM 등으로 원격 실행. 권한은 server.view, server.start, server.stop 등으로 분리. |
| **우선 적용** | 1단계 메뉴 재구성만 먼저 적용하고, 서버 업다운은 요구사항(대상 서버 OS, 인증 방식, 에이전트 여부) 정리 후 2단계로 설계·구현 권장. |

이 문서는 검토용 제안이며, 실제 반영 시 SPEC.md·권한 매트릭스·스키마와 함께 단계별로 수정하면 됩니다.
