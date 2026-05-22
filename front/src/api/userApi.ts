import apiClient from './axiosInstance';

const fnCatchApiError = (error: any, strFallback: string) => {
  if (error.response?.data) return error.response.data;
  return { bSuccess: false, strMessage: error.message || strFallback };
};

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
  arrRoles: string[];
}) => {
  try {
    const response = await apiClient.post('/users', objData);
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '사용자 생성에 실패했습니다.');
  }
};

// 사용자 수정 (이름, 역할)
export const fnApiUpdateUser = async (nId: number, objData: {
  strDisplayName?: string;
  arrRoles?: string[];
}) => {
  try {
    const response = await apiClient.put(`/users/${nId}`, objData);
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '사용자 수정에 실패했습니다.');
  }
};

// 사용자 삭제
export const fnApiDeleteUser = async (nId: number) => {
  try {
    const response = await apiClient.delete(`/users/${nId}`);
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '사용자 삭제에 실패했습니다.');
  }
};

// 비밀번호 초기화
export const fnApiResetPassword = async (nId: number, strNewPassword: string) => {
  try {
    const response = await apiClient.patch(`/users/${nId}/password`, { strNewPassword });
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '비밀번호 초기화에 실패했습니다.');
  }
};
