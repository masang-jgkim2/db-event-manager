import apiClient from './axiosInstance';
import type { ILoginRequest, ILoginResponse } from '../types';

// 로그인 API
export const fnApiLogin = async (objData: ILoginRequest): Promise<ILoginResponse> => {
  const response = await apiClient.post<ILoginResponse>('/auth/login', objData);
  return response.data;
};

// 토큰 검증 API
export const fnApiVerifyToken = async (): Promise<ILoginResponse> => {
  const response = await apiClient.get<ILoginResponse>('/auth/verify');
  return response.data;
};
