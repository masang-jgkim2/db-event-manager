import apiClient from './axiosInstance';

const fnCatchApiError = (error: any, strFallback: string) => {
  if (error.response?.data) return error.response.data;
  return { bSuccess: false, strMessage: error.message || strFallback };
};

// 쿼리 템플릿 목록 조회
export const fnApiGetEvents = async () => {
  const response = await apiClient.get('/events');
  return response.data;
};

// 이벤트 추가
export const fnApiCreateEvent = async (objData: Record<string, unknown>) => {
  try {
    const response = await apiClient.post('/events', objData);
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '등록에 실패했습니다.');
  }
};

// 이벤트 수정
export const fnApiUpdateEvent = async (nId: number, objData: Record<string, unknown>) => {
  try {
    const response = await apiClient.put(`/events/${nId}`, objData);
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '수정에 실패했습니다.');
  }
};

// 이벤트 삭제
export const fnApiDeleteEvent = async (nId: number) => {
  try {
    const response = await apiClient.delete(`/events/${nId}`);
    return response.data;
  } catch (error: any) {
    return fnCatchApiError(error, '삭제에 실패했습니다.');
  }
};
