// 사용자 정보
export interface IUser {
  nId: number;
  strUserId: string;
  strDisplayName: string;
  strRole: string;
}

// 로그인 요청
export interface ILoginRequest {
  strUserId: string;
  strPassword: string;
}

// 로그인 응답
export interface ILoginResponse {
  bSuccess: boolean;
  strToken?: string;
  user?: IUser;
  strMessage?: string;
}

// 인증 상태 스토어
export interface IAuthStore {
  user: IUser | null;
  strToken: string | null;
  bIsAuthenticated: boolean;
  bIsLoading: boolean;
  fnLogin: (strUserId: string, strPassword: string) => Promise<boolean>;
  fnLogout: () => void;
  fnVerifyToken: () => Promise<boolean>;
}

// 프로덕트 (게임/서비스)
export interface IProduct {
  nId: number;
  strName: string;
  strDescription: string;
  strDbType: 'mysql' | 'mssql' | 'postgresql';
  dtCreatedAt: string;
}

// 이벤트 템플릿
export interface IEventTemplate {
  nId: number;
  nProductId: number;
  strProductName?: string;
  strName: string;
  strDescription: string;
  strQueryTemplate: string;
  arrParams: IEventParam[];
  dtCreatedAt: string;
}

// 이벤트 파라미터 정의
export interface IEventParam {
  strKey: string;
  strLabel: string;
  strType: 'string' | 'number' | 'date' | 'datetime' | 'select';
  bRequired: boolean;
  strDefaultValue?: string;
  arrOptions?: string[]; // select 타입일 때 선택지
}

// 쿼리 생성 로그
export interface IQueryLog {
  nId: number;
  nEventTemplateId: number;
  strEventName: string;
  strProductName: string;
  strGeneratedQuery: string;
  strCreatedBy: string;
  dtCreatedAt: string;
}
