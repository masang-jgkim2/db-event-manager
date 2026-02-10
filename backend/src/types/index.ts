// 사용자 인터페이스
export interface IUser {
  nId: number;
  strUserId: string;
  strPassword: string;
  strDisplayName: string;
  strRole: 'admin' | 'gm' | 'planner' | 'dba';
  dtCreatedAt: Date;
}

// JWT 페이로드
export interface IJwtPayload {
  nId: number;
  strUserId: string;
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
  user?: {
    nId: number;
    strUserId: string;
    strDisplayName: string;
    strRole: string;
  };
  strMessage?: string;
}
