// =============================================
// 사용자 관련
// =============================================
export interface IUser {
  nId: number;
  strUserId: string;
  strDisplayName: string;
  strRole: string;
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

// 이벤트 상태 워크플로
export type TEventStatus =
  | 'event_created'    // 운영자 이벤트 생성
  | 'dba_confirmed'    // DBA 컨펌 확인
  | 'qa_deployed'      // DBA QA 반영
  | 'qa_verified'      // 운영자 QA 확인
  | 'live_deployed'    // DBA LIVE 반영
  | 'live_verified';   // 운영자 LIVE 확인 (완료)

// 상태 라벨/색상 매핑
export const OBJ_STATUS_CONFIG: Record<TEventStatus, { strLabel: string; strColor: string }> = {
  event_created:  { strLabel: '이벤트 생성',    strColor: 'blue' },
  dba_confirmed:  { strLabel: 'DBA 컨펌',      strColor: 'cyan' },
  qa_deployed:    { strLabel: 'QA 반영',       strColor: 'orange' },
  qa_verified:    { strLabel: 'QA 확인',       strColor: 'gold' },
  live_deployed:  { strLabel: 'LIVE 반영',     strColor: 'volcano' },
  live_verified:  { strLabel: 'LIVE 확인',     strColor: 'green' },
};

// 상태 변경 이력
export interface IStatusLog {
  strStatus: TEventStatus;
  strChangedBy: string;
  strComment: string;
  dtChangedAt: string;
}

// 이벤트 인스턴스
export interface IEventInstance {
  nId: number;
  nEventTemplateId: number;
  strEventLabel: string;
  strProductName: string;
  strServiceAbbr: string;
  strServiceRegion: string;
  strCategory: string;
  strType: string;
  strEventName: string;
  strInputValues: string;
  strGeneratedQuery: string;
  dtExecDate: string;
  strStatus: TEventStatus;
  arrStatusLogs: IStatusLog[];
  strCreatedBy: string;
  nCreatedByUserId: number;
  dtCreatedAt: string;
}
