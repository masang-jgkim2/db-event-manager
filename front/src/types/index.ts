import type { TTagVariant } from '../styles/tagPalette';

// =============================================
// 권한 코드 (백엔드 types와 동기 — JWT arrPermissions 전부)
// =============================================
export type TPermission =
  | 'dashboard.view'
  | 'product.view' | 'product.create' | 'product.edit' | 'product.delete' | 'product.manage'
  | 'event_template.view' | 'event_template.create' | 'event_template.edit' | 'event_template.delete' | 'event_template.manage'
  | 'event_template.request_confirm' | 'event_template.confirm'
  | 'user.view' | 'user.create' | 'user.edit' | 'user.delete' | 'user.reset_password' | 'user.approve' | 'user.manage'
  | 'role.view' | 'role.create' | 'role.edit' | 'role.delete' | 'role.edit_permissions'
  | 'db_connection.view' | 'db_connection.create' | 'db_connection.edit' | 'db_connection.delete' | 'db_connection.test' | 'db.manage'
  | 'my_dashboard.view' | 'my_dashboard.detail' | 'my_dashboard.edit' | 'my_dashboard.request_confirm' | 'my_dashboard.query_edit' | 'my_dashboard.confirm'
  | 'my_dashboard.request_qa' | 'my_dashboard.execute_qa' | 'my_dashboard.verify_qa' | 'my_dashboard.request_qa_rereq'
  | 'my_dashboard.request_live' | 'my_dashboard.execute_live' | 'my_dashboard.verify_live' | 'my_dashboard.request_live_rereq' | 'my_dashboard.hide'
  | 'my_dashboard.delete' | 'my_dashboard.delete_instance'
  | 'my_dashboard.delete_any'
  | 'instance.delete_own'
  | 'my_dashboard.edit_any'
  | 'instance.view' | 'instance.create' | 'instance.approve_qa' | 'instance.execute_qa' | 'instance.verify_qa'
  | 'instance.approve_live' | 'instance.execute_live' | 'instance.verify_live'
  | 'system.save_test_seed'
  | 'activity.view' | 'activity.clear';

// 권한 표시 라벨
export const OBJ_PERMISSION_LABELS: Record<TPermission, string> = {
  'dashboard.view': '대시보드 보기',
  'product.view': '프로덕트 조회',
  'product.create': '프로덕트 생성',
  'product.edit': '프로덕트 수정',
  'product.delete': '프로덕트 삭제',
  'product.manage': '프로덕트 관리 (CRUD)',
  'event_template.view': '쿼리 템플릿 조회',
  'event_template.create': '쿼리 템플릿 생성',
  'event_template.edit': '쿼리 템플릿 수정',
  'event_template.delete': '쿼리 템플릿 삭제',
  'event_template.manage': '쿼리 템플릿 관리 (CRUD)',
  'event_template.request_confirm': '템플릿 쿼리 리뷰 요청',
  'event_template.confirm': '템플릿 DBA 리뷰 완료',
  'user.view': '사용자 조회',
  'user.create': '사용자 생성',
  'user.edit': '사용자 수정',
  'user.delete': '사용자 삭제',
  'user.reset_password': '비밀번호 초기화',
  'user.approve': '가입 승인',
  'user.manage': '사용자 관리',
  'role.view': '역할 조회',
  'role.create': '역할 생성',
  'role.edit': '역할 수정',
  'role.delete': '역할 삭제',
  'role.edit_permissions': '역할 권한 수정',
  'db_connection.view': 'DB 접속 조회',
  'db_connection.create': 'DB 접속 생성',
  'db_connection.edit': 'DB 접속 수정',
  'db_connection.delete': 'DB 접속 삭제',
  'db_connection.test': 'DB 연결 테스트',
  'db.manage': 'DB 접속 정보 관리',
  'my_dashboard.view': '나의 대시보드 보기',
  'my_dashboard.detail': '나의 대시보드 상세',
  'my_dashboard.edit': '이벤트 수정',
  'my_dashboard.request_confirm': '컨펌 요청',
  'my_dashboard.query_edit': '쿼리 수정',
  'my_dashboard.confirm': 'DBA 컨펌',
  'my_dashboard.request_qa': 'QA 반영 요청',
  'my_dashboard.execute_qa': 'QA 반영 실행',
  'my_dashboard.verify_qa': 'QA 확인',
  'my_dashboard.request_qa_rereq': 'QA 재반영 요청',
  'my_dashboard.request_live': 'LIVE 반영 요청',
  'my_dashboard.execute_live': 'LIVE 반영 실행',
  'my_dashboard.verify_live': 'LIVE 확인',
  'my_dashboard.request_live_rereq': 'LIVE 재반영 요청',
  'my_dashboard.hide': '숨기기/복원',
  'my_dashboard.delete': '이벤트 삭제(레거시)',
  'my_dashboard.delete_instance': '이벤트 삭제(레거시)',
  'my_dashboard.delete_any': '타인 이벤트 삭제',
  'my_dashboard.edit_any': '타인 이벤트 수정',
  'instance.view': '이벤트 생성 보기',
  'instance.create': '이벤트 생성',
  'instance.delete_own': '내 이벤트 삭제',
  'instance.approve_qa': 'QA 승인',
  'instance.execute_qa': 'QA DB 실행',
  'instance.verify_qa': 'QA 확인',
  'instance.approve_live': 'LIVE 승인',
  'instance.execute_live': 'LIVE DB 실행',
  'instance.verify_live': 'LIVE 확인',
  'system.save_test_seed': '테스트 시드 저장',
  'activity.view': '활동 로그 조회',
  'activity.clear': '활동 로그 전체 삭제',
};

/** 세분화 권한 그룹 (역할 권한 수정 화면용) */
export interface IPermissionGroupItem {
  value: string;
  label: string;
}
export interface IPermissionGroup {
  groupLabel: string;
  permissions: IPermissionGroupItem[];
}

export const ARR_PERMISSION_GROUPS: IPermissionGroup[] = [
  { groupLabel: '대시보드', permissions: [{ value: 'dashboard.view', label: '보기' }] },
  { groupLabel: '프로덕트', permissions: [
    { value: 'product.view', label: '보기' },
    { value: 'product.create', label: '생성' },
    { value: 'product.edit', label: '수정' },
    { value: 'product.delete', label: '삭제' },
  ]},
  { groupLabel: '쿼리 템플릿', permissions: [
    { value: 'event_template.view', label: '보기' },
    { value: 'event_template.create', label: '생성' },
    { value: 'event_template.edit', label: '수정' },
    { value: 'event_template.delete', label: '삭제' },
    { value: 'event_template.request_confirm', label: '쿼리 리뷰 요청' },
    { value: 'event_template.confirm', label: 'DBA 리뷰 완료' },
  ]},
  { groupLabel: 'DB 접속 정보', permissions: [
    { value: 'db_connection.view', label: '보기' },
    { value: 'db_connection.create', label: '생성' },
    { value: 'db_connection.edit', label: '수정' },
    { value: 'db_connection.delete', label: '삭제' },
    { value: 'db_connection.test', label: '연결 테스트' },
  ]},
  { groupLabel: '사용자', permissions: [
    { value: 'user.view', label: '보기' },
    { value: 'user.create', label: '생성' },
    { value: 'user.edit', label: '수정' },
    { value: 'user.delete', label: '삭제' },
    { value: 'user.reset_password', label: '비밀번호 초기화' },
    { value: 'user.approve', label: '가입 승인' },
  ]},
  { groupLabel: '역할 권한', permissions: [
    { value: 'role.view', label: '보기' },
    { value: 'role.create', label: '생성' },
    { value: 'role.edit', label: '수정' },
    { value: 'role.delete', label: '삭제' },
    { value: 'role.edit_permissions', label: '권한 수정' },
  ]},
  { groupLabel: '활동', permissions: [
    { value: 'activity.view', label: '활동 로그 조회' },
    { value: 'activity.clear', label: '활동 로그 전체 삭제' },
  ]},
  { groupLabel: '나의 대시보드', permissions: [
    { value: 'my_dashboard.view', label: '보기' },
    { value: 'my_dashboard.detail', label: '상세' },
    { value: 'my_dashboard.edit', label: '이벤트 수정' },
    { value: 'my_dashboard.edit_any', label: '타인 이벤트 수정' },
    { value: 'my_dashboard.request_confirm', label: '컨펌 요청' },
    { value: 'my_dashboard.query_edit', label: '쿼리 수정' },
    { value: 'my_dashboard.confirm', label: 'DBA 컨펌' },
    { value: 'my_dashboard.request_qa', label: 'QA 반영 요청' },
    { value: 'my_dashboard.execute_qa', label: 'QA 반영 실행' },
    { value: 'my_dashboard.verify_qa', label: 'QA 확인' },
    { value: 'my_dashboard.request_qa_rereq', label: 'QA 재반영 요청' },
    { value: 'my_dashboard.request_live', label: 'LIVE 반영 요청' },
    { value: 'my_dashboard.execute_live', label: 'LIVE 반영 실행' },
    { value: 'my_dashboard.verify_live', label: 'LIVE 확인' },
    { value: 'my_dashboard.request_live_rereq', label: 'LIVE 재반영 요청' },
    { value: 'my_dashboard.hide', label: '숨기기/복원' },
    { value: 'my_dashboard.delete_any', label: '타인 이벤트 삭제' },
  ]},
  { groupLabel: '이벤트 생성', permissions: [
    { value: 'instance.view', label: '보기' },
    { value: 'instance.create', label: '생성' },
    { value: 'instance.delete_own', label: '내 이벤트 삭제' },
  ]},
  { groupLabel: '시스템', permissions: [
    { value: 'system.save_test_seed', label: '테스트 시드 저장' },
  ]},
];

/** 권한 코드 → 한글 표시명 (액션 오류 시 필요한 권한 안내용) */
export const OBJ_PERMISSION_DISPLAY: Record<string, string> = (() => {
  const obj: Record<string, string> = {};
  ARR_PERMISSION_GROUPS.forEach((g) => g.permissions.forEach((p) => { obj[p.value] = p.label; }));
  return obj;
})();

/** 서버 403 메시지에서 권한 코드를 한글명으로 보강해 반환 (액션 오류 시 필요한 권한 안내) */
export function fnFormatPermissionErrorMessage(strMessage: string): string {
  if (!strMessage || !strMessage.includes('권한')) return strMessage;
  const arrParts: string[] = [];
  const arrKnown = Object.keys(OBJ_PERMISSION_DISPLAY);
  for (const code of arrKnown) {
    if (strMessage.includes(code)) {
      arrParts.push(`${OBJ_PERMISSION_DISPLAY[code]}(${code})`);
    }
  }
  if (arrParts.length > 0) {
    return `${strMessage} 필요 권한: ${arrParts.join(', ')}`;
  }
  return strMessage;
}

/** 레거시 권한 → 세분화 권한 (백엔드 roles.ts OBJ_EXPAND와 동기화) */
const OBJ_LEGACY_EXPAND: Record<string, string[]> = {
  'product.manage': ['product.view', 'product.create', 'product.edit', 'product.delete'],
  'event_template.manage': ['event_template.view', 'event_template.create', 'event_template.edit', 'event_template.delete', 'event_template.request_confirm', 'event_template.confirm'],
  'user.manage': ['user.view', 'user.create', 'user.edit', 'user.delete', 'user.reset_password', 'user.approve'],
  'db.manage': ['db_connection.view', 'db_connection.create', 'db_connection.edit', 'db_connection.delete', 'db_connection.test'],
  'instance.create': ['instance.view'],
  'my_dashboard.request_confirm': ['event_template.request_confirm'],
  'my_dashboard.confirm': ['event_template.confirm'],
  'instance.approve_qa': ['my_dashboard.request_qa', 'my_dashboard.request_qa_rereq'],
  'instance.execute_qa': ['my_dashboard.execute_qa', 'my_dashboard.confirm'],
  'instance.verify_qa': ['my_dashboard.verify_qa'],
  'instance.approve_live': ['my_dashboard.request_live', 'my_dashboard.request_live_rereq'],
  'instance.execute_live': ['my_dashboard.execute_live'],
  'instance.verify_live': ['my_dashboard.verify_live'],
  'my_dashboard.delete': ['my_dashboard.delete_any'],
  'my_dashboard.delete_instance': ['my_dashboard.delete_any'],
};

/** admin 역할 — 로그인 시 fnExpandPermissions 보너스 (역할 편집 폼 표시용) */
const ARR_ADMIN_ROLE_FORM_BONUS: string[] = [
  'dashboard.view', 'my_dashboard.view', 'my_dashboard.edit_any',
  'user.view', 'user.create', 'user.edit', 'user.delete', 'user.reset_password', 'user.approve',
  'role.view', 'role.create', 'role.edit', 'role.delete', 'role.edit_permissions',
  'db_connection.view', 'db_connection.create', 'db_connection.edit', 'db_connection.delete', 'db_connection.test',
  'system.save_test_seed', 'activity.view', 'activity.clear',
];

export function fnExpandLegacyToGranular(arrRaw: string[]): string[] {
  const setOut = new Set<string>(arrRaw);
  arrRaw.forEach((p) => {
    const exp = OBJ_LEGACY_EXPAND[p];
    if (exp) exp.forEach((e) => setOut.add(e));
  });
  return Array.from(setOut);
}

/** 역할 편집 폼 체크박스 — 저장값 + 레거시 확장 + admin 보너스 (로그인 effective와 동일 표시) */
export function fnExpandPermissionsForRoleFormDisplay(arrRaw: string[], strRoleCode?: string): TPermission[] {
  const setOut = new Set<string>(fnExpandLegacyToGranular(arrRaw));
  if (strRoleCode === 'admin') {
    ARR_ADMIN_ROLE_FORM_BONUS.forEach((p) => setOut.add(p));
  }
  return Array.from(setOut) as TPermission[];
}

/** 체크박스 UI에 없는 저장 권한 — 저장 시 유실 방지용 */
export function fnGetOrphanRolePermissions(arrRaw: string[]): string[] {
  const setGroup = new Set(ARR_PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.value)));
  const setLegacy = new Set(Object.keys(OBJ_LEGACY_EXPAND));
  return arrRaw.filter((p) => !setGroup.has(p) && !setLegacy.has(p));
}

// =============================================
// 역할 모델
// =============================================
export interface IRole {
  nId: number;
  strCode: string;
  strDisplayName: string;
  strDescription: string;
  arrPermissions: TPermission[];
  bIsSystem: boolean;
  dtCreatedAt: string;
  dtUpdatedAt: string;
}

// =============================================
// 사용자 관련
// =============================================
export interface IUser {
  nId: number;
  strUserId: string;
  strDisplayName: string;
  strEmail?: string | null;
  strStatus?: string;
  arrRoles: string[];           // 역할 코드 배열 (멀티 역할)
  arrPermissions: TPermission[];
  mapRoleDisplayNames?: Record<string, string>; // 역할 코드 → 표시명 (헤더·태그용)
}

export interface ILoginRequest {
  strUserId: string;
  strPassword: string;
}

export interface ILoginResponse {
  bSuccess: boolean;
  strToken?: string;
  user?: IUser;
  strMessage?: string;
  strErrorCode?: string;
}

export interface IAuthStore {
  user: IUser | null;
  strToken: string | null;
  bIsAuthenticated: boolean;
  bIsLoading: boolean;
  fnLogin: (strUserId: string, strPassword: string) => Promise<boolean>;
  fnLogout: () => Promise<void>;
  fnVerifyToken: () => Promise<boolean>;
}

// =============================================
// 프로덕트 관련
// =============================================

// 국가/플랫폼 (프로덕트 하위 — FH/KR, LH/KR, DK/KR, DK/G …)
export interface IService {
  nServiceId?: number;  // backfill·생성 후 필수
  strAbbr: string;     // 약자 (예: FH/KR, LH/KR, DK/KR, DK/G)
  strRegion: string;   // 플랫폼 (국내, 스팀, 글로벌, 유럽, 일본)
}

// 프로덕트 (게임/서비스)
export interface IProduct {
  nId: number;
  strName: string;          // 프로덕트명 (예: DK온라인)
  strDescription: string;
  strDbType: 'mysql' | 'mssql' | 'postgresql';
  arrServices: IService[];  // 국가/플랫폼 목록
  dtCreatedAt: string;
}

// 서비스 범위 옵션
export const ARR_REGION_OPTIONS = ['국내', '스팀', '글로벌', '유럽', '일본'] as const;

// =============================================
// 쿼리 템플릿 관련
// =============================================

// 이벤트 종류
export type TEventCategory = '아이템' | '퀘스트';
export const ARR_EVENT_CATEGORIES: TEventCategory[] = ['아이템', '퀘스트'];

// 이벤트 유형
export type TEventType = '삭제' | '지급' | '초기화';
export const ARR_EVENT_TYPES: TEventType[] = ['삭제', '지급', '초기화'];

// 입력 형식
export type TInputFormat = 'item_number' | 'item_string' | 'date' | 'none';
export const ARR_INPUT_FORMATS: { value: TInputFormat; label: string }[] = [
  { value: 'item_number', label: '번호' },
  { value: 'item_string', label: '문자열' },
  { value: 'date', label: '날짜' },
  { value: 'none', label: '입력 없음' },
];

// 템플릿 내 쿼리 1세트: QA/LIVE DB 연결 + (선택) 기본 아이템값 + 쿼리 템플릿
export interface IQueryTemplateItem {
  nQaDbConnectionId: number;
  nLiveDbConnectionId: number;
  /** @deprecated nQaDbConnectionId 로 이관 */
  nDbConnectionId?: number;
  strDefaultItems?: string;
  strQueryTemplate: string;
}

// 쿼리 템플릿 워크플로
export type TTemplateStatus =
  | 'template_created'
  | 'confirm_requested'
  | 'dba_confirmed';

export const ARR_TEMPLATE_STATUSES: TTemplateStatus[] = [
  'template_created',
  'confirm_requested',
  'dba_confirmed',
];

export const OBJ_TEMPLATE_STATUS_CONFIG: Record<TTemplateStatus, { strLabel: string; strTagVariant: TTagVariant }> = {
  template_created:   { strLabel: '템플릿 등록',   strTagVariant: 'muted' },
  confirm_requested:  { strLabel: '쿼리 리뷰 요청', strTagVariant: 'tone3' },
  dba_confirmed:      { strLabel: 'DBA 리뷰 완료', strTagVariant: 'tone4' },
};

// 쿼리 템플릿
export interface IEventTemplate {
  nId: number;
  nProductId: number;
  strProductName?: string;
  strEventLabel: string;          // 이벤트 이름 (예: 어워드 이벤트 종료(아이템))
  strDescription: string;
  strCategory: TEventCategory;    // 이벤트 종류 (아이템/퀘스트)
  strType: TEventType;            // 이벤트 유형 (삭제/지급/초기화)
  strInputFormat: TInputFormat;   // 입력 형식
  strDefaultItems: string;        // 기본 아이템 값 (예시값)
  strQueryTemplate: string;       // SQL 쿼리 템플릿 (레거시 단일)
  arrQueryTemplates?: IQueryTemplateItem[];  // 종류별 쿼리 템플릿 (있으면 이걸 사용)
  dtCreatedAt: string;
  strCreatedBy?: string;
  nCreatedByUserId?: number;
  strStatus?: TTemplateStatus;
  arrStatusLogs?: Array<{
    strStatus: TTemplateStatus;
    strChangedBy: string;
    nChangedByUserId: number;
    strComment?: string;
    dtChangedAt: string;
    objQueryEdit?: IQueryEditLog;
  }>;
  objCreator?: { strDisplayName: string; nUserId: number; strUserId: string; dtProcessedAt: string } | null;
  objConfirmer?: { strDisplayName: string; nUserId: number; strUserId: string; dtProcessedAt: string } | null;
}

// =============================================
// 이벤트 인스턴스 (운영자가 생성한 실제 이벤트)
// =============================================

// 단일 서버 쿼리(한 환경) vs 다중 서버 쿼리(QA+LIVE) — DEV는 UI 선택 불가(백엔드 차단)
export type TDeployScope = 'qa' | 'live';

export const ARR_DEPLOY_SCOPE_OPTIONS: { value: TDeployScope; label: string; strTagVariant: TTagVariant }[] = [
  { value: 'qa',   label: 'QA',   strTagVariant: 'tone6' },
  { value: 'live', label: 'LIVE', strTagVariant: 'tone9' },
];

// 이벤트 상태 워크플로 (7단계)
export type TEventStatus =
  | 'event_created'       // 운영자 이벤트 생성 (수정 가능)
  | 'qa_requested'        // 운영자 QA 반영 요청
  | 'qa_deployed'         // DBA QA 반영
  | 'qa_verified'         // 운영자 QA 확인
  | 'live_requested'      // 운영자 라이브 반영 요청
  | 'live_deployed'       // DBA LIVE 반영
  | 'live_verified';      // 운영자 LIVE 확인 (완료)

/** Phase 3 이전 인스턴스 상태 — 진행 이력 표시용 */
export type TLegacyInstanceStatus = 'confirm_requested' | 'dba_confirmed';

export type TInstanceStatusLogStatus = TEventStatus | TLegacyInstanceStatus;

// 상태 라벨/색상 — 나의 대시보드 권한 이름과 동일 (작성 중→생성, 완료 유지)
export const OBJ_STATUS_CONFIG: Record<TEventStatus, { strLabel: string; strTagVariant: TTagVariant }> = {
  event_created:      { strLabel: '생성',            strTagVariant: 'muted' },
  qa_requested:       { strLabel: 'QA 반영 요청',   strTagVariant: 'tone5' },
  qa_deployed:        { strLabel: 'QA 반영 실행',    strTagVariant: 'tone6' },
  qa_verified:        { strLabel: 'QA 확인',        strTagVariant: 'tone7' },
  live_requested:     { strLabel: 'LIVE 반영 요청',  strTagVariant: 'tone8' },
  live_deployed:      { strLabel: 'LIVE 반영 실행',  strTagVariant: 'tone2' },
  live_verified:      { strLabel: '완료',            strTagVariant: 'success' },
};

/** 레거시 인스턴스 상태 라벨 (이력·알림 표시) */
export const OBJ_LEGACY_INSTANCE_STATUS_CONFIG: Record<TLegacyInstanceStatus, { strLabel: string; strTagVariant: TTagVariant }> = {
  confirm_requested:  { strLabel: '컨펌 요청',       strTagVariant: 'tone3' },
  dba_confirmed:      { strLabel: 'DBA 컨펌 완료',   strTagVariant: 'tone4' },
};

export const fnGetInstanceStatusConfig = (
  strStatus: string,
): { strLabel: string; strTagVariant: TTagVariant } | undefined => {
  if (strStatus in OBJ_STATUS_CONFIG) {
    return OBJ_STATUS_CONFIG[strStatus as TEventStatus];
  }
  if (strStatus in OBJ_LEGACY_INSTANCE_STATUS_CONFIG) {
    return OBJ_LEGACY_INSTANCE_STATUS_CONFIG[strStatus as TLegacyInstanceStatus];
  }
  return undefined;
};

// 프로세스 진행에 따른 현재 환경 (QA / LIVE / DEV 중 하나만 표시)
export type TDisplayEnv = 'DEV' | 'QA' | 'LIVE';
export const fnGetDisplayEnv = (strStatus: TEventStatus): TDisplayEnv | null => {
  if (strStatus.startsWith('live_')) return 'LIVE';
  if (strStatus.startsWith('qa_')) return 'QA';
  if (strStatus === 'event_created') return 'DEV';
  return null;
};

export const OBJ_DISPLAY_ENV_TAG: Record<TDisplayEnv, TTagVariant> = {
  DEV: 'muted',
  QA: 'tone6',
  LIVE: 'tone9',
};

/** @deprecated OBJ_DISPLAY_ENV_TAG 사용 */
export const OBJ_DISPLAY_ENV_COLOR = OBJ_DISPLAY_ENV_TAG;

// 쿼리 개별 실행 결과
export interface IQueryPartResult {
  nIndex: number;
  strQuery: string;
  nAffectedRows: number;
  arrResultColumns?: string[];
  arrResultRows?: Record<string, string | number | boolean | null>[];
  bResultTruncated?: boolean;
  /** 다중 실행 세트일 때만 */
  nSetIndex?: number;
  nSetTotal?: number;
}

// 쿼리 전체 실행 결과
export interface IQueryExecutionResult {
  bSuccess: boolean;
  strEnv: 'qa' | 'live';
  strExecutedQuery: string;
  arrQueryResults: IQueryPartResult[];
  nTotalAffectedRows: number;
  nElapsedMs: number;
  strError?: string;
  strRollbackMsg?: string;
  dtExecutedAt: string;
}

// DB 접속 종류
export type TDbConnectionKind = 'GAME' | 'WEB' | 'LOG';
export const ARR_DB_CONNECTION_KINDS: TDbConnectionKind[] = ['GAME', 'WEB', 'LOG'];

// DB 접속 정보
export interface IDbConnection {
  nId: number;
  nProductId: number;
  strProductName: string;
  /** products.arrServices[].strAbbr — denormalized */
  strServiceAbbr?: string;
  /** product_service.n_id — NULL=공통 fallback */
  nServiceId?: number | null;
  strKind: TDbConnectionKind;
  strEnv: 'dev' | 'qa' | 'live';
  strDbType: 'mssql' | 'mysql';
  strHost: string;
  nPort: number;
  strDatabase: string;
  strUser: string;
  strPassword: string;
  bIsActive: boolean;
  dtCreatedAt: string;
  dtUpdatedAt: string;
}

/** DBA 쿼리 직접 수정 diff (진행 이력) */
export interface IQueryEditLog {
  strBefore?: string;
  strAfter?: string;
  arrSetChanges?: Array<{
    nSetIndex: number;
    strBefore: string;
    strAfter: string;
  }>;
}

// 상태 변경 이력
export interface IStatusLog {
  strStatus: TInstanceStatusLogStatus;
  strChangedBy: string;
  nChangedByUserId: number;
  strComment: string;
  dtChangedAt: string;
  objQueryEdit?: IQueryEditLog;
  objExecutionResult?: {
    strEnv: 'qa' | 'live';
    bSuccess?: boolean;
    nTotalAffectedRows: number;
    nElapsedMs: number;
    strError?: string;
    strConnectionSummary?: string;
    arrQueryResults: IQueryPartResult[];
  };
}

// 단계별 처리자
export interface IStageActor {
  strDisplayName: string;
  nUserId: number;
  strUserId: string;
  dtProcessedAt: string;
}

// 이벤트 인스턴스
export interface IEventInstance {
  nId: number;
  nEventTemplateId: number;
  nProductId: number;
  nServiceId?: number;
  strEventLabel: string;
  strProductName: string;
  strServiceAbbr: string;
  strServiceRegion: string;
  strCategory: string;
  strType: string;
  strEventName: string;
  strInputValues: string;
  strGeneratedQuery: string;
  arrExecutionTargets?: Array<{ nQaDbConnectionId: number; nLiveDbConnectionId: number; nDbConnectionId?: number; strQuery: string }>;
  /** @deprecated dtQaDeployDate / dtLiveDeployDate 분리 후 하위 호환용 */
  dtDeployDate: string;
  dtQaDeployDate?: string;          // QA 반영 날짜 (이 시각 이전에 QA 실행 허용)
  dtLiveDeployDate?: string;        // LIVE 반영 날짜 (이 시각 이후에 LIVE 실행 허용)
  strAlloLink?: string;             // 업무 링크 URL (알로·코웤 등, 선택)
  arrDeployScope: TDeployScope[];   // 반영 범위 ['qa','live'] or ['live']
  strStatus: TEventStatus;
  arrStatusLogs: IStatusLog[];
  // 단계별 처리자 (추적용)
  objCreator: IStageActor | null;
  objConfirmer: IStageActor | null;
  objQaRequester: IStageActor | null;
  objQaDeployer: IStageActor | null;
  objQaVerifier: IStageActor | null;
  objLiveRequester: IStageActor | null;
  objLiveDeployer: IStageActor | null;
  objLiveVerifier: IStageActor | null;
  // 메타
  strCreatedBy: string;
  nCreatedByUserId: number;
  dtCreatedAt: string;
  /** 서버 삭제(bPermanentlyRemoved) — 복원 불가, 완료·숨김 탭에만 표시 */
  bPermanentlyRemoved?: boolean;
  dtPermanentlyRemovedAt?: string;
}
