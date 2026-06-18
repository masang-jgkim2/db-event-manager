import apiClient from './axiosInstance';
import type { IEventInstance } from '../types';

const fnCatchApiError = (error: any, strFallback: string) => {
  if (error.response?.data) return error.response.data;
  return { bSuccess: false, strMessage: error.message || strFallback };
};

// 쿼리 템플릿 목록 조회
export const fnApiGetEvents = async () => {
  const response = await apiClient.get('/events');
  return response.data;
};

/** 템플릿에 연결된 이벤트 인스턴스 목록 */
export const fnApiGetEventInstancesByTemplate = async (nTemplateId: number) => {
  try {
    const response = await apiClient.get(`/events/${nTemplateId}/instances`);
    return response.data as {
      bSuccess: boolean;
      arrInstances?: IEventInstance[];
      nActiveRefCount?: number;
      nRemovedRefCount?: number;
      strMessage?: string;
    };
  } catch (error: unknown) {
    return fnCatchApiError(error, '연결 이벤트 목록을 불러올 수 없습니다.');
  }
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
    return response.data as {
      bSuccess: boolean;
      objEvent?: Record<string, unknown>;
      bReapprovalRequired?: boolean;
      strMessage?: string;
    };
  } catch (error: any) {
    return fnCatchApiError(error, '수정에 실패했습니다.');
  }
};

/** DBA 리뷰 대기 중 쿼리·세트만 수정 */
export const fnApiUpdateEventQuery = async (nId: number, objData: Record<string, unknown>) => {
  try {
    const response = await apiClient.put(`/events/${nId}/query`, objData);
    return response.data as { bSuccess: boolean; objEvent?: Record<string, unknown>; strMessage?: string };
  } catch (error: unknown) {
    return fnCatchApiError(error, '쿼리 수정에 실패했습니다.');
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

/** 쿼리 템플릿 워크플로 상태 전이 */
export const fnApiPatchEventStatus = async (
  nId: number,
  strNextStatus: string,
  strComment?: string,
) => {
  try {
    const response = await apiClient.patch(`/events/${nId}/status`, { strNextStatus, strComment });
    return response.data;
  } catch (error: unknown) {
    return fnCatchApiError(error, '상태 변경에 실패했습니다.');
  }
};
