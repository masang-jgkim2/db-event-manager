import apiClient from './axiosInstance';

const fnCatchApiError = (error: any, strFallback: string) => {
  if (error.response?.data) return error.response.data;
  return { bSuccess: false, strMessage: error.message || strFallback };
};

// 프로덕트 목록 조회
export const fnApiGetProducts = async () => {
  const response = await apiClient.get('/products');
  return response.data;
};

// 프로덕트 추가
export const fnApiCreateProduct = async (objData: {
  strName: string;
  strDescription: string;
  strDbType: string;
  arrServices: { strAbbr: string; strRegion: string }[];
}) => {
  try {
    const response = await apiClient.post('/products', objData);
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '등록에 실패했습니다.');
  }
};

// 프로덕트 수정
export const fnApiUpdateProduct = async (nId: number, objData: Record<string, unknown>) => {
  try {
    const response = await apiClient.put(`/products/${nId}`, objData);
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '수정에 실패했습니다.');
  }
};

// 프로덕트 삭제
export const fnApiDeleteProduct = async (nId: number) => {
  try {
    const response = await apiClient.delete(`/products/${nId}`);
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '삭제에 실패했습니다.');
  }
};
