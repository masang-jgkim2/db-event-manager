# 조사: 사용자 역할 권한 vs 이벤트 진행 프로세스

## 요약

- **이벤트 진행 프로세스(상태 전이) 자체는 문서/코드와 일치**하며, 문제 없음.
- **문제는 “역할만 보는 구간”과 “권한만 보는 구간”이 섞여 있어서** 발생합니다.
  - **상태 전이(PATCH `/api/event-instances/:id/status`)**: 백엔드가 **역할(arrRoles)** 만 검사함.
  - **QA/LIVE 실행(POST `/api/event-instances/:id/execute`)**: **권한(arrPermissions)** 만 검사함.
- 그 결과, **권한만 있고 해당 역할이 없는 사용자**는 프론트에서 버튼이 보이지만, 상태 전이 시 **403**이 발생할 수 있습니다.

---

## 1. 이벤트 진행 프로세스 (상태 전이)

### 1.1 설계(문서)와 코드 일치 여부

- 9단계 워크플로, 반영 범위에 따른 QA 스킵, 재요청 전이 모두 `eventInstanceController.ts`의 `OBJ_STATUS_TRANSITIONS_BASE` 및 `fnGetTransitions`와 일치합니다.
- **이벤트 진행 프로세스 자체에 대한 설계/구현 불일치는 없습니다.**

### 1.2 상태별 허용 역할 (백엔드 기준)

| 현재 상태         | 다음 상태       | 허용 (백엔드)        |
|------------------|-----------------|----------------------|
| event_created    | confirm_requested | game_manager, game_designer, admin |
| confirm_requested | dba_confirmed   | **dba, admin**       |
| qa_requested     | qa_deployed     | dba, admin (실제 전이는 POST execute에서 수행) |
| qa_deployed      | qa_verified / qa_requested | game_manager, game_designer, admin |
| qa_verified      | live_requested / qa_requested | game_manager, game_designer, admin |
| live_requested   | live_deployed   | dba, admin (실제 전이는 POST execute에서 수행) |
| live_deployed    | live_verified / live_requested | game_manager, game_designer, admin |
| live_verified    | live_requested | game_manager, game_designer, admin |

- `qa_deployed` / `live_deployed` 로의 전이는 **PATCH status가 아니라 POST execute** 핸들러 안에서 상태를 바꿉니다.  
  따라서 “실행”은 **권한**으로만 통제되고, “DBA 컨펌” 등 **PATCH로만 이루어지는 전이**는 **역할**로만 통제됩니다.

---

## 2. 백엔드 검사 방식

### 2.1 PATCH `/api/event-instances/:id/status` (상태 변경)

- **미들웨어**: 권한 검사 없음 (인증만).
- **컨트롤러 `fnUpdateStatus`**:
  - `req.user?.arrRoles`(역할)만 사용.
  - `objTransition.arrAllowedRoles`에 포함된 역할이 하나라도 있으면 통과.
  - **`arrPermissions`는 사용하지 않음.**

```ts
// eventInstanceController.ts
const arrUserRoles = req.user?.arrRoles || [];
const bHasRole = objTransition.arrAllowedRoles.some((r) => arrUserRoles.includes(r));
if (!bHasRole) {
  res.status(403).json({ ... });
  return;
}
```

- 따라서 **“DBA 컨펌”(confirm_requested → dba_confirmed)** 은 **역할이 dba 또는 admin일 때만** 성공합니다.  
  권한만 주고 역할을 주지 않은 사용자는 403입니다.

### 2.2 POST `/api/event-instances/:id/execute` (QA/LIVE 실행)

- **미들웨어**: `fnRequireAnyPermission('instance.execute_qa', 'instance.execute_live')` → **권한**만 검사.
- **컨트롤러 `fnExecuteAndDeploy`**: 역할 추가 검사 없음. 권한 통과하면 실행 및 상태 전이(qa_deployed / live_deployed)까지 수행.

즉, **실행**은 권한 기반, **상태 전이(PATCH)** 는 역할 기반으로 동작합니다.

---

## 3. 프론트엔드 버튼 노출 조건

- **DBA 컨펌**  
  `fnHasPermission('instance.execute_qa') || fnHasPermission('instance.execute_live') || bIsDbaOrAdmin`  
  → **권한만 있어도** 버튼이 보임.

- **QA 반영 / LIVE 반영**  
  동일하게 `fnHasPermission('instance.execute_qa') || bIsDbaOrAdmin` 등으로 **권한 또는 dba/admin 역할**로 노출.

그래서 **권한만 부여된 사용자(역할은 dba/admin 아님)** 는:

- “컨펌” 버튼이 보이지만,
- “컨펌” 클릭 시 PATCH `/status` → 백엔드는 역할만 보므로 **403**이 나올 수 있습니다.

---

## 4. 결론: 원인 정리

| 구분           | 원인 |
|----------------|------|
| **이벤트 진행 프로세스** | 설계와 구현 일치. 프로세스 자체는 문제 없음. |
| **사용자 역할/권한**   | **상태 전이(PATCH)** 는 역할만 보고, **실행(POST)** 는 권한만 봄. 프론트는 권한/역할 둘 다로 버튼을 보여줘서, “권한만 있는 사용자”가 상태 전이에서 403을 받는 불일치가 있음. |

따라서 **“사용자 역할 권한이 문제인지, 이벤트 진행 프로세스가 문제인지”** 에 대한 답은:

- **이벤트 진행 프로세스(상태/전이 규칙)** 는 문제 없음.
- **역할과 권한을 어디서 어떻게 쓰는지가 일관되지 않아** 문제가 발생함.  
  특히 **PATCH status에서만 역할을 보는 것**이 원인입니다.

---

## 5. 권장 수정 방향

- **문서/설계**  
  `PERMISSION-MENU-ACTION-MATRIX.md` 등에서는 “DBA 컨펌”을  
  `my_dashboard.confirm` (또는 `instance.execute_qa` / `instance.execute_live` 또는 dba/admin) 로 정의하고 있음.  
  즉, **권한 OR 역할**로 동작하는 것이 의도에 가깝습니다.

- **권장: 백엔드에서 상태 전이 시 권한도 허용**  
  - `fnUpdateStatus`에서 `arrAllowedRoles`가 `['dba','admin']`인 전이(현재는 **confirm_requested → dba_confirmed**)인 경우,  
    **역할이 dba/admin이 아니어도**  
    `instance.execute_qa`, `instance.execute_live`, `my_dashboard.confirm` 중 하나라도 있으면 통과하도록 변경.
  - 필요하면 `live_requested → live_deployed` 등 다른 “dba 전용” 전이도, PATCH로 처리하는 구간이 있다면 동일하게 권한으로 허용할 수 있음.

- **대안: 프론트만 맞추기**  
  - “DBA 컨펌” 버튼을 **역할(dba/admin)이 있을 때만** 보이도록 하고, 권한만으로는 노출하지 않음.  
  - 이렇게 하면 403은 사라지지만, “권한만으로 컨펌 가능”한 설계와는 맞지 않게 됨.

**정리**: 이벤트 진행 프로세스는 그대로 두고, **상태 전이 시 백엔드에서 권한도 함께 검사**하도록 바꾸는 쪽을 권장합니다.
