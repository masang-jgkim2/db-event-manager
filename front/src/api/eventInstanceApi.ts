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

// 이벤트 인스턴스 수정 (event_created 상태에서만)
export const fnApiUpdateInstance = async (nId: number, objData: Record<string, unknown>) => {
  const response = await apiClient.put(`/event-instances/${nId}`, objData);
  return response.data;
};

// 이벤트 상태 변경
export const fnApiUpdateStatus = async (nId: number, strNextStatus: string, strComment: string = '', strActorName: string = '') => {
  const response = await apiClient.patch(`/event-instances/${nId}/status`, { strNextStatus, strComment, strActorName });
  return response.data;
};

// QA/LIVE DB 쿼리 실행 (실제 DB 반영)
// axios는 4xx/5xx를 throw하므로 catch로 서버 응답을 그대로 반환
export const fnApiExecuteQuery = async (nId: number, strEnv: 'qa' | 'live', strActorName: string = '') => {
  try {
    const response = await apiClient.post(`/event-instances/${nId}/execute`, { strEnv, strActorName });
    return response.data;
  } catch (error: any) {
    // 서버가 4xx/5xx로 응답한 경우 → 서버 바디를 그대로 반환 (bSuccess: false + strMessage)
    if (error.response?.data) {
      return error.response.data;
    }
    // 네트워크/타임아웃 오류
    return {
      bSuccess: false,
      strMessage: error.message || '네트워크 오류가 발생했습니다.',
    };
  }
};
