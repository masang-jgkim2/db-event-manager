import axios from 'axios';
import { create } from 'zustand';
import type { IAuthStore, ILoginResponse } from '../types';
import { fnApiLogin, fnApiLogout, fnApiVerifyToken } from '../api/authApi';

// 인증 상태 관리 스토어
export const useAuthStore = create<IAuthStore>((set) => ({
  user: null,
  strToken: localStorage.getItem('strToken'),
  bIsAuthenticated: false,
  bIsLoading: false,

  // 로그인
  fnLogin: async (strUserId: string, strPassword: string): Promise<boolean> => {
    set({ bIsLoading: true });
    try {
      const objResult = await fnApiLogin({ strUserId, strPassword });

      if (objResult.bSuccess && objResult.strToken && objResult.user) {
        localStorage.setItem('strToken', objResult.strToken);
        set({
          user: objResult.user,
          strToken: objResult.strToken,
          bIsAuthenticated: true,
          bIsLoading: false,
        });
        return true;
      }

      set({ bIsLoading: false });
      const strMsg = objResult.strMessage ?? '아이디 또는 비밀번호가 올바르지 않습니다.';
      const errAuth = new Error(strMsg) as Error & { strErrorCode?: string };
      errAuth.strErrorCode = objResult.strErrorCode;
      throw errAuth;
    } catch (err: unknown) {
      set({ bIsLoading: false });
      if (axios.isAxiosError(err) && err.response?.data) {
        const objData = err.response.data as ILoginResponse;
        const strMsg = objData.strMessage ?? '로그인에 실패했습니다.';
        const errAuth = new Error(strMsg) as Error & { strErrorCode?: string };
        errAuth.strErrorCode = objData.strErrorCode;
        throw errAuth;
      }
      if (axios.isAxiosError(err) && !err.response) {
        throw err;
      }
      throw err instanceof Error ? err : new Error('로그인에 실패했습니다.');
    }
  },

  // 로그아웃 (서버 기록 후 로컬 토큰 제거)
  fnLogout: async () => {
    try {
      await fnApiLogout();
    } catch (err) {
      console.error('[로그아웃] API 호출 실패 | 로컬 세션은 해제합니다.', err);
    }
    localStorage.removeItem('strToken');
    set({
      user: null,
      strToken: null,
      bIsAuthenticated: false,
    });
  },

  // 토큰 검증 (자동 로그인)
  fnVerifyToken: async (): Promise<boolean> => {
    const strToken = localStorage.getItem('strToken');
    if (!strToken) {
      set({ bIsAuthenticated: false });
      return false;
    }

    set({ bIsLoading: true });
    try {
      const objResult = await fnApiVerifyToken();

      if (objResult.bSuccess && objResult.user) {
        set({
          user: objResult.user,
          bIsAuthenticated: true,
          bIsLoading: false,
        });
        return true;
      }

      localStorage.removeItem('strToken');
      set({ bIsAuthenticated: false, bIsLoading: false });
      return false;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        const objData = err.response.data as ILoginResponse;
        console.log(`[인증] 토큰 거부 | ${objData.strErrorCode ?? ''} | ${objData.strMessage ?? ''}`);
      }
      localStorage.removeItem('strToken');
      set({ bIsAuthenticated: false, bIsLoading: false });
      return false;
    }
  },
}));
