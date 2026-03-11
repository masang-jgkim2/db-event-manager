import apiClient from './axiosInstance';
import type { IDbConnection } from '../types';

// DB 접속 정보 목록 조회
export const fnApiGetDbConnections = async () => {
  const response = await apiClient.get('/db-connections');
  return response.data;
};

// DB 접속 정보 추가
export const fnApiCreateDbConnection = async (objData: Partial<IDbConnection>) => {
  const response = await apiClient.post('/db-connections', objData);
  return response.data;
};

// DB 접속 정보 수정
export const fnApiUpdateDbConnection = async (nId: number, objData: Partial<IDbConnection>) => {
  const response = await apiClient.put(`/db-connections/${nId}`, objData);
  return response.data;
};

// DB 접속 정보 삭제
export const fnApiDeleteDbConnection = async (nId: number) => {
  const response = await apiClient.delete(`/db-connections/${nId}`);
  return response.data;
};

// 연결 테스트
export const fnApiTestDbConnection = async (nId: number) => {
  const response = await apiClient.post(`/db-connections/${nId}/test`);
  return response.data;
};
