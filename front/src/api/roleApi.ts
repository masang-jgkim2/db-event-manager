import apiClient from './axiosInstance';
import type { IRole } from '../types';

// 역할 목록 조회
export const fnApiGetRoles = async () => {
  const response = await apiClient.get('/roles');
  return response.data;
};

// 역할 추가
export const fnApiCreateRole = async (objData: Partial<IRole>) => {
  const response = await apiClient.post('/roles', objData);
  return response.data;
};

// 역할 수정
export const fnApiUpdateRole = async (nId: number, objData: Partial<IRole>) => {
  const response = await apiClient.put(`/roles/${nId}`, objData);
  return response.data;
};

// 역할 삭제
export const fnApiDeleteRole = async (nId: number) => {
  const response = await apiClient.delete(`/roles/${nId}`);
  return response.data;
};
