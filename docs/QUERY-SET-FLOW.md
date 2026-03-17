# 쿼리 세트(다중) 관련 흐름 정리

템플릿에서 **쿼리 세트를 여러 개** 두었을 때, 어디서 세트가 반영되고 어디서는 1개만 쓰이는지 정리한 문서입니다.

---

## 1. 흐름 요약

```
[이벤트 템플릿] arrQueryTemplates N개 저장
       ↓
[이벤트 생성]   템플릿 기준으로 arrExecutionTargets N개 생성·전송, strGeneratedQuery(미리보기/첫세트) 전송
       ↓
[인스턴스 저장] arrExecutionTargets 저장, strGeneratedQuery 저장(첫세트 또는 단일용)
       ↓
[나의 대시보드] 상세·쿼리수정·실행 → 현재는 strGeneratedQuery 1개만 사용
```

---

## 2. 구간별 동작

| 구분 | 파일/위치 | 세트 여러 개 시 동작 | 비고 |
|------|-----------|------------------------|------|
| **이벤트 템플릿** | EventPage | ✅ 세트 N개 저장 (arrQueryTemplates) | 탭 숨김 후 "쿼리 템플릿"만 표시 |
| **이벤트 템플릿 API** | eventController (POST/PUT) | ✅ arrQueryTemplates 수신·저장 | 단일 모드일 때만 세트 비움 |
| **이벤트 생성** | QueryPage | ✅ arrQueryTemplates 기준으로 arrTargets N개 생성 → arrExecutionTargets로 전송 | strGeneratedQuery는 미리보기/첫세트만 |
| **인스턴스 생성 API** | eventInstanceController (POST) | ✅ arrExecutionTargets 수신·저장 | strGeneratedQuery도 저장(첫세트 등) |
| **인스턴스 수정(일반)** | eventInstanceController (PUT) | event_created일 때 arrExecutionTargets 수정 가능(코드상) | 쿼리 재생성 시 arrExecutionTargets 세팅 |
| **쿼리 실행 (QA/LIVE)** | eventInstanceController Execute | ❌ **strGeneratedQuery 1개 + 프로덕트·env 단일 연결**만 사용 | 주석: "단일 쿼리 템플릿 롤백" |
| **나의 대시보드 상세** | MyDashboardPage (상세 모달) | ❌ **strGeneratedQuery 1개만** 표시 ("최종 쿼리") | arrExecutionTargets 미표시 |
| **나의 대시보드 쿼리 수정** | MyDashboardPage (DBA 쿼리 수정) | ❌ **strGeneratedQuery 1개만** 편집·저장 | arrExecutionTargets 별도 수정 없음 |
| **나의 대시보드 이벤트 수정** | MyDashboardPage (수정 모달) | event_created에서 필드 수정; 쿼리 재생성 시 템플릿 기준으로 strGeneratedQuery·arrExecutionTargets 세팅 | 백엔드에서 arrExecutionTargets 처리 |

---

## 3. 관련 타입·데이터

| 데이터 | 위치 | 설명 |
|--------|------|------|
| arrQueryTemplates | 이벤트 템플릿 (events.json) | 세트당 nDbConnectionId, strQueryTemplate, strDefaultItems |
| arrExecutionTargets | 이벤트 인스턴스 (eventInstances.json) | 세트당 nDbConnectionId, strQuery (생성된 쿼리) |
| strGeneratedQuery | 이벤트 인스턴스 | 단일용 또는 다중일 때 **첫 세트 쿼리**(미리보기/실행용으로 1개만 사용) |

---

## 4. 세트 여러 개를 끝까지 쓰려면

- **실행**: Execute에서 **arrExecutionTargets**가 있으면, env별로 target 순회하며 `fnFindConnectionById(nDbConnectionId)` → `fnExecuteQueryWithText(conn, target.strQuery, strEnv)` 호출하도록 분기 추가. (현재는 strGeneratedQuery + 단일 연결만 사용.)
- **나의 대시보드 상세**: "최종 쿼리"를 **arrExecutionTargets**가 있으면 세트별로 표시(연결명/ID + 쿼리), 없으면 strGeneratedQuery만 표시.
- **나의 대시보드 쿼리 수정**: arrExecutionTargets가 있으면 세트별 편집(또는 "첫 세트만 수정" 등 정책 결정 후 UI·API 반영).

지금은 **생성·저장**까지는 세트 N개가 반영되고, **실행·상세·쿼리수정**은 1개(strGeneratedQuery)만 사용하는 구조입니다.
