import apiClient from './axiosInstance';
import type { IRole } from '../types';

const fnCatchApiError = (error: any, strFallback: string) => {
  if (error.response?.data) return error.response.data;
  return { bSuccess: false, strMessage: error.message || strFallback };
};

// 역할 목록 조회
export const fnApiGetRoles = async () => {
  const response = await apiClient.get('/roles');
  return response.data;
};

// 역할 추가
export const fnApiCreateRole = async (objData: Partial<IRole>) => {
  try {
    const response = await apiClient.post('/roles', objData);
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '역할 생성에 실패했습니다.');
  }
};

// 역할 수정
export const fnApiUpdateRole = async (nId: number, objData: Partial<IRole>) => {
  try {
    const response = await apiClient.put(`/roles/${nId}`, objData);
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '역할 수정에 실패했습니다.');
  }
};

// 역할 삭제
export const fnApiDeleteRole = async (nId: number) => {
  try {
    const response = await apiClient.delete(`/roles/${nId}`);
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '역할 삭제에 실패했습니다.');
  }
};
