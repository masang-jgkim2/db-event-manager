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
// 쿼리 생성 관련
// =============================================

// 쿼리 생성 로그
export interface IQueryLog {
  nId: number;
  strEventName: string;       // 자동 생성된 이벤트 이름
  strProductName: string;
  strServiceAbbr: string;     // 서비스 약자
  strServiceRegion: string;   // 서비스 범위
  strCategory: string;        // 이벤트 종류
  strType: string;            // 이벤트 유형
  strInputValues: string;     // 입력된 값
  strGeneratedQuery: string;  // 생성된 쿼리
  strCreatedBy: string;
  dtCreatedAt: string;
}
