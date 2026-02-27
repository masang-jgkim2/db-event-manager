import apiClient from './axiosInstance';

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
  const response = await apiClient.post('/products', objData);
  return response.data;
};

// 프로덕트 수정
export const fnApiUpdateProduct = async (nId: number, objData: Record<string, unknown>) => {
  const response = await apiClient.put(`/products/${nId}`, objData);
  return response.data;
};

// 프로덕트 삭제
export const fnApiDeleteProduct = async (nId: number) => {
  const response = await apiClient.delete(`/products/${nId}`);
  return response.data;
};
