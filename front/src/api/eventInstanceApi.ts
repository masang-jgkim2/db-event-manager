import apiClient, { STR_API_BASE } from './axiosInstance';

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

/** 다중 세트 실행 시 SSE 스트리밍으로 진행율 이벤트 수신. onProgress(completed) 호출 후 최종 결과 반환 */
export const fnApiExecuteQueryStream = async (
  nId: number,
  strEnv: 'qa' | 'live',
  strActorName: string,
  onProgress: (nCompleted: number) => void
): Promise<{ bSuccess: boolean; strMessage?: string; objInstance?: unknown; objExecutionResult?: unknown }> => {
  const strToken = typeof localStorage !== 'undefined' ? localStorage.getItem('strToken') : null;
  const res = await fetch(`${STR_API_BASE}/event-instances/${nId}/execute?stream=1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(strToken ? { Authorization: `Bearer ${strToken}` } : {}),
    },
    body: JSON.stringify({ strEnv, strActorName }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { bSuccess: false, strMessage: (data as { strMessage?: string }).strMessage || res.statusText };
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let objFinal: { bSuccess: boolean; strMessage?: string; objInstance?: unknown; objExecutionResult?: unknown } = { bSuccess: false };

  if (!reader) {
    return { bSuccess: false, strMessage: '스트림을 읽을 수 없습니다.' };
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const obj = JSON.parse(line.slice(6).trim()) as { type: string; completed?: number; total?: number; strMessage?: string; objExecutionResult?: unknown; objInstance?: unknown };
          if (obj.type === 'progress' && typeof obj.completed === 'number') {
            onProgress(obj.completed);
          } else if (obj.type === 'done') {
            objFinal = { bSuccess: true, objExecutionResult: obj.objExecutionResult, objInstance: obj.objInstance };
          } else if (obj.type === 'error') {
            objFinal = {
              bSuccess: false,
              strMessage: (obj as { strMessage?: string }).strMessage || '실행 중 오류가 발생했습니다.',
              objExecutionResult: (obj as { objExecutionResult?: unknown }).objExecutionResult,
            };
          }
        } catch {
          // ignore parse error
        }
      }
    }
  }
  return objFinal;
};
