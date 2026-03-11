import apiClient from './axiosInstance';

// 이벤트 목록 조회
export const fnApiGetEvents = async () => {
  const response = await apiClient.get('/events');
  return response.data;
};

// 이벤트 추가
export const fnApiCreateEvent = async (objData: Record<string, unknown>) => {
  const response = await apiClient.post('/events', objData);
  return response.data;
};

// 이벤트 수정
export const fnApiUpdateEvent = async (nId: number, objData: Record<string, unknown>) => {
  const response = await apiClient.put(`/events/${nId}`, objData);
  return response.data;
};

// 이벤트 삭제
export const fnApiDeleteEvent = async (nId: number) => {
  const response = await apiClient.delete(`/events/${nId}`);
  return response.data;
};
