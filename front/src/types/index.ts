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
