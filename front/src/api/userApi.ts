import apiClient from './axiosInstance';

// 사용자 목록 조회
export const fnApiGetUsers = async () => {
  const response = await apiClient.get('/users');
  return response.data;
};

// 사용자 추가
export const fnApiCreateUser = async (objData: {
  strUserId: string;
  strPassword: string;
  strDisplayName: string;
  strRole: string;
}) => {
  const response = await apiClient.post('/users', objData);
  return response.data;
};

// 사용자 삭제
export const fnApiDeleteUser = async (nId: number) => {
  const response = await apiClient.delete(`/users/${nId}`);
  return response.data;
};

// 비밀번호 초기화
export const fnApiResetPassword = async (nId: number, strNewPassword: string) => {
  const response = await apiClient.patch(`/users/${nId}/password`, { strNewPassword });
  return response.data;
};
