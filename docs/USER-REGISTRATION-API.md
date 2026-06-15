# 회원 가입 · 승인 — API 스펙 (Phase A)

> 구현 기준: `backend/src/controllers/registrationController.ts`, `userController.ts`, `authController.ts`

## 공통

- **아이디 규칙**: 영문·숫자만, 4~32자, 저장 시 소문자 (`REG_USER_ID`)
- **이메일**: `@masangsoft.com` 필수 (가입 시)
- **인증**: 승인·거절·사용자 목록은 JWT + 권한 필요

---

## 공개 API

### `GET /api/auth/check-register`

가입 전 아이디·이메일 중복 확인.

| Query | 설명 |
|-------|------|
| `strUserId` | 아이디 (선택) |
| `strEmailLocal` | `@` 앞부분 (선택) |

**응답 200**

```json
{
  "bSuccess": true,
  "bUserIdAvailable": true,
  "bEmailAvailable": true,
  "strEmail": "hong@masangsoft.com"
}
```

`null` 필드는 해당 query 미전달.

---

### `POST /api/auth/register`

| Body | 필수 | 설명 |
|------|------|------|
| `strUserId` | O | 영문·숫자 4~32 |
| `strEmail` | O | 전체 주소 (`@masangsoft.com`) |
| `strDisplayName` | O | 표시 이름 |
| `strPassword` | O | 8자 이상 |

**성공 201**: `pending_approval`, 역할 `guest` 부여(승인 전 로그인 불가).

**실패**: 400 형식, 409 아이디/이메일 중복.

---

### `POST /api/auth/login`

**승인 대기·거절·비활성** 시 403:

| `strErrorCode` | 메시지 요약 |
|----------------|-------------|
| `pending_approval` | 승인 대기 — 로그인 불가 |
| `rejected` | 가입 거절 |
| `disabled` | 비활성 |

---

## 관리자 API (`user.approve` 또는 `user.manage`)

### `GET /api/users?strStatus=pending_approval`

승인 대기 목록 필터.

### `PATCH /api/users/:id/approve`

```json
{ "arrRoles": ["game_manager"] }
```

- `str_status` → `active`
- `user_roles` → 선택 역할로 교체 (guest 제거)

### `PATCH /api/users/:id/reject`

- `str_status` → `rejected`
- 로그인·API 차단 (`fnGetUserAuthBlock`)

### `POST /api/users` (기존)

관리자 직접 추가 → 즉시 `active`, `strEmail` 선택.

---

## DB · JSON

| 저장소 | 필드 |
|--------|------|
| `users` / `users.json` | `str_email`, `str_status` |
| `user_roles` | 가입 시 `guest`(nRoleId 6) |

MySQL 모드: `fnCommitUserDataStore` 후 `users.json` 미러.

---

## 미구현 (Phase B 이후)

- `POST /api/auth/resend-verification`
- `GET /verify-email?token=`
- `pending_email` 상태·로그인 분기
