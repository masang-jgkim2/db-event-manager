import apiClient from './axiosInstance';
import type { IDbConnection } from '../types';

// DB 접속 정보 목록 조회
export const fnApiGetDbConnections = async () => {
  const response = await apiClient.get('/db-connections');
  return response.data;
};

// DB 접속 정보 추가 — 4xx 에러도 data 그대로 반환 (중복 등 구체적 원인 표시용)
export const fnApiCreateDbConnection = async (objData: Partial<IDbConnection>) => {
  try {
    const response = await apiClient.post('/db-connections', objData);
    return response.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    return { bSuccess: false, strMessage: error.message || '등록에 실패했습니다.' };
  }
};

// DB 접속 정보 수정 — 4xx 에러도 data 그대로 반환
export const fnApiUpdateDbConnection = async (nId: number, objData: Partial<IDbConnection>) => {
  try {
    const response = await apiClient.put(`/db-connections/${nId}`, objData);
    return response.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    return { bSuccess: false, strMessage: error.message || '수정에 실패했습니다.' };
  }
};

// DB 접속 정보 삭제 — 4xx 에러도 data 그대로 반환
export const fnApiDeleteDbConnection = async (nId: number) => {
  try {
    const response = await apiClient.delete(`/db-connections/${nId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    return { bSuccess: false, strMessage: error.message || '삭제에 실패했습니다.' };
  }
};

// 연결 테스트 — 4xx 에러도 data 그대로 반환
export const fnApiTestDbConnection = async (nId: number) => {
  try {
    const response = await apiClient.post(`/db-connections/${nId}/test`);
    return response.data;
  } catch (error: any) {
    if (error.response?.data) return error.response.data;
    return { bSuccess: false, strMessage: error.message || '연결 테스트에 실패했습니다.' };
  }
};
