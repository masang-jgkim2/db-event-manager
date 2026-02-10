import apiClient from './axiosInstance';

// 이벤트 인스턴스 목록 조회
export const fnApiGetInstances = async (strFilter: string = 'all') => {
  const response = await apiClient.get(`/event-instances?filter=${strFilter}`);
  return response.data;
};

// 이벤트 인스턴스 단건 조회
export const fnApiGetInstance = async (nId: number) => {
  const response = await apiClient.get(`/event-instances/${nId}`);
  return response.data;
};

// 이벤트 인스턴스 생성
export const fnApiCreateInstance = async (objData: Record<string, unknown>) => {
  const response = await apiClient.post('/event-instances', objData);
  return response.data;
};

// 이벤트 상태 변경
export const fnApiUpdateStatus = async (nId: number, strNextStatus: string, strComment: string = '', strActorName: string = '') => {
  const response = await apiClient.patch(`/event-instances/${nId}/status`, { strNextStatus, strComment, strActorName });
  return response.data;
};
