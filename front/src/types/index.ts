// =============================================
// 권한 코드
// =============================================
export type TPermission =
  // 조회 권한
  | 'product.view'              // 프로덕트 목록/상세 조회
  | 'event_template.view'       // 이벤트 템플릿 목록/상세 조회
  // 관리 권한 (CRUD)
  | 'product.manage'            // 프로덕트 CRUD (view 포함)
  | 'event_template.manage'     // 이벤트 템플릿 CRUD (view 포함)
  | 'user.manage'               // 사용자 관리
  | 'db.manage'                 // DB 접속 정보 관리
  // 이벤트 인스턴스 권한
  | 'instance.view'             // 이벤트 생성 페이지 보기
  | 'instance.create'            // 이벤트 인스턴스 생성
  | 'instance.approve_qa'       // QA 승인 요청
  | 'instance.execute_qa'       // QA DB 실제 실행
  | 'instance.verify_qa'        // QA 결과 확인
  | 'instance.approve_live'     // LIVE 승인 요청
  | 'instance.execute_live'     // LIVE DB 실제 실행
  | 'instance.verify_live';     // LIVE 결과 확인

// 권한 표시 라벨
export const OBJ_PERMISSION_LABELS: Record<TPermission, string> = {
  'product.view':            '프로덕트 조회',
  'event_template.view':     '이벤트 템플릿 조회',
  'product.manage':          '프로덕트 관리 (CRUD)',
  'event_template.manage':   '이벤트 템플릿 관리 (CRUD)',
  'user.manage':             '사용자 관리',
  'db.manage':               'DB 접속 정보 관리',
  'instance.view':          '이벤트 생성 보기',
  'instance.create':         '이벤트 생성',
  'instance.approve_qa':     'QA 승인',
  'instance.execute_qa':     'QA DB 실행',
  'instance.verify_qa':      'QA 확인',
  'instance.approve_live':   'LIVE 승인',
  'instance.execute_live':   'LIVE DB 실행',
  'instance.verify_live':    'LIVE 확인',
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
  { groupLabel: '이벤트 템플릿', permissions: [
    { value: 'event_template.view', label: '보기' },
    { value: 'event_template.create', label: '생성' },
    { value: 'event_template.edit', label: '수정' },
    { value: 'event_template.delete', label: '삭제' },
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
  ]},
  { groupLabel: '역할 권한', permissions: [
    { value: 'role.view', label: '보기' },
    { value: 'role.create', label: '생성' },
    { value: 'role.edit', label: '수정' },
    { value: 'role.delete', label: '삭제' },
    { value: 'role.edit_permissions', label: '권한 수정' },
  ]},
  { groupLabel: '나의 대시보드', permissions: [
    { value: 'my_dashboard.edit', label: '이벤트 수정' },
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
  ]},
  { groupLabel: '이벤트 생성', permissions: [
    { value: 'instance.view', label: '보기' },
    { value: 'instance.create', label: '생성' },
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

/** 레거시 권한 → 세분화 권한으로 확장 (역할 편집 폼 초기값용) */
const OBJ_LEGACY_EXPAND: Record<string, string[]> = {
  'product.manage': ['product.view', 'product.create', 'product.edit', 'product.delete'],
  'event_template.manage': ['event_template.view', 'event_template.create', 'event_template.edit', 'event_template.delete'],
  'user.manage': ['user.view', 'user.create', 'user.edit', 'user.delete', 'user.reset_password'],
  'db.manage': ['db_connection.view', 'db_connection.create', 'db_connection.edit', 'db_connection.delete', 'db_connection.test'],
  'instance.approve_qa': ['my_dashboard.request_qa', 'my_dashboard.request_qa_rereq'],
  'instance.execute_qa': ['my_dashboard.execute_qa', 'my_dashboard.query_edit', 'my_dashboard.confirm'],
  'instance.verify_qa': ['my_dashboard.verify_qa'],
  'instance.approve_live': ['my_dashboard.request_live', 'my_dashboard.request_live_rereq'],
  'instance.execute_live': ['my_dashboard.execute_live'],
  'instance.verify_live': ['my_dashboard.verify_live'],
  'instance.create': ['my_dashboard.edit', 'my_dashboard.request_confirm', 'instance.view', 'instance.create'],
};
export function fnExpandLegacyToGranular(arrRaw: string[]): string[] {
  const setOut = new Set<string>(arrRaw);
  arrRaw.forEach((p) => {
    const exp = OBJ_LEGACY_EXPAND[p];
    if (exp) exp.forEach((e) => setOut.add(e));
  });
  return Array.from(setOut);
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
  arrRoles: string[];           // 역할 코드 배열 (멀티 역할)
  arrPermissions: TPermission[];
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
}

export interface IAuthStore {
  user: IUser | null;
  strToken: string | null;
  bIsAuthenticated: boolean;
  bIsLoading: boolean;
  fnLogin: (strUserId: string, strPassword: string) => Promise<boolean>;
  fnLogout: () => void;
  fnVerifyToken: () => Promise<boolean>;
}

// =============================================
// 프로덕트 관련
// =============================================

// 서비스 범위 (프로덕트 하위)
export interface IService {
  strAbbr: string;     // 약자 (예: DK/KR, AO/EU)
  strRegion: string;   // 서비스 범위 (국내, 스팀, 글로벌, 유럽, 일본)
}

// 프로덕트 (게임/서비스)
export interface IProduct {
  nId: number;
  strName: string;          // 프로젝트명 (예: DK온라인)
  strDescription: string;
  strDbType: 'mysql' | 'mssql' | 'postgresql';
  arrServices: IService[];  // 서비스 범위 목록
  dtCreatedAt: string;
}

// 서비스 범위 옵션
export const ARR_REGION_OPTIONS = ['국내', '스팀', '글로벌', '유럽', '일본'] as const;

// =============================================
// 이벤트 템플릿 관련
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
  { value: 'item_number', label: '아이템 번호 (숫자, 쉼표 구분)' },
  { value: 'item_string', label: '아이템 문자열 (줄바꿈 구분)' },
  { value: 'date', label: '날짜' },
  { value: 'none', label: '입력 없음' },
];

// 이벤트 템플릿
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
  strQueryTemplate: string;       // SQL 쿼리 템플릿
  dtCreatedAt: string;
}

// =============================================
// 이벤트 인스턴스 (운영자가 생성한 실제 이벤트)
// =============================================

// 반영 범위 — DEV는 UI에서 선택 불가(백엔드 차단), QA→LIVE가 기본값
export type TDeployScope = 'qa' | 'live';
export const ARR_DEPLOY_SCOPE_OPTIONS: { value: TDeployScope; label: string; strColor: string }[] = [
  { value: 'qa',   label: 'QA',   strColor: 'orange' },
  { value: 'live', label: 'LIVE', strColor: 'red' },
];

// 이벤트 상태 워크플로
export type TEventStatus =
  | 'event_created'       // 운영자 이벤트 생성 (수정 가능)
  | 'confirm_requested'   // 운영자 컨펌 요청 (수정 불가)
  | 'dba_confirmed'       // DBA 컨펌 확인
  | 'qa_requested'        // 운영자 QA 반영 요청
  | 'qa_deployed'         // DBA QA 반영
  | 'qa_verified'         // 운영자 QA 확인
  | 'live_requested'      // 운영자 라이브 반영 요청
  | 'live_deployed'       // DBA LIVE 반영
  | 'live_verified';      // 운영자 LIVE 확인 (완료)

// 상태 라벨/색상 매핑
export const OBJ_STATUS_CONFIG: Record<TEventStatus, { strLabel: string; strColor: string }> = {
  event_created:      { strLabel: '작성 중',         strColor: 'default' },
  confirm_requested:  { strLabel: '컨펌 요청',       strColor: 'blue' },
  dba_confirmed:      { strLabel: 'DBA 컨펌',       strColor: 'cyan' },
  qa_requested:       { strLabel: 'QA 반영 요청',   strColor: 'geekblue' },
  qa_deployed:        { strLabel: 'QA 반영',        strColor: 'orange' },
  qa_verified:        { strLabel: 'QA 확인',        strColor: 'gold' },
  live_requested:     { strLabel: 'LIVE 반영 요청', strColor: 'magenta' },
  live_deployed:      { strLabel: 'LIVE 반영',      strColor: 'volcano' },
  live_verified:      { strLabel: '완료',            strColor: 'green' },
};

// 쿼리 개별 실행 결과
export interface IQueryPartResult {
  nIndex: number;
  strQuery: string;
  nAffectedRows: number;
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

// DB 접속 정보
export interface IDbConnection {
  nId: number;
  nProductId: number;
  strProductName: string;
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

// 상태 변경 이력
export interface IStatusLog {
  strStatus: TEventStatus;
  strChangedBy: string;
  nChangedByUserId: number;
  strComment: string;
  dtChangedAt: string;
  objExecutionResult?: {
    strEnv: 'qa' | 'live';
    nTotalAffectedRows: number;
    nElapsedMs: number;
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
  strEventLabel: string;
  strProductName: string;
  strServiceAbbr: string;
  strServiceRegion: string;
  strCategory: string;
  strType: string;
  strEventName: string;
  strInputValues: string;
  strGeneratedQuery: string;
  dtDeployDate: string;             // 반영 날짜 (datetime, ISO 8601)
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
}
