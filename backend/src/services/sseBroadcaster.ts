import { Response } from 'express';
import { IEventInstance } from '../data/eventInstances';

// SSE 클라이언트 연결 풀
// Map<userId, Set<Response>> - 같은 유저가 여러 탭 열 수 있음
const mapClients = new Map<number, Set<Response>>();

// 클라이언트 등록
export const fnRegisterClient = (nUserId: number, res: Response): void => {
  if (!mapClients.has(nUserId)) {
    mapClients.set(nUserId, new Set());
  }
  mapClients.get(nUserId)!.add(res);
};

// 클라이언트 제거
export const fnUnregisterClient = (nUserId: number, res: Response): void => {
  const setClients = mapClients.get(nUserId);
  if (setClients) {
    setClients.delete(res);
    if (setClients.size === 0) {
      mapClients.delete(nUserId);
    }
  }
};

// SSE 이벤트 전송 헬퍼
const fnSendEvent = (res: Response, strEvent: string, objData: unknown): void => {
  try {
    res.write(`event: ${strEvent}\n`);
    res.write(`data: ${JSON.stringify(objData)}\n\n`);
  } catch {
    // 연결이 이미 끊어진 경우 무시
  }
};

// 특정 유저에게만 전송
export const fnBroadcastToUser = (nUserId: number, strEvent: string, objData: unknown): void => {
  const setClients = mapClients.get(nUserId);
  if (setClients) {
    for (const res of setClients) {
      fnSendEvent(res, strEvent, objData);
    }
  }
};

// 모든 연결된 클라이언트에게 브로드캐스트
export const fnBroadcastAll = (strEvent: string, objData: unknown): void => {
  for (const setClients of mapClients.values()) {
    for (const res of setClients) {
      fnSendEvent(res, strEvent, objData);
    }
  }
};

// 신규 이벤트 인스턴스 생성 브로드캐스트
// 생성자 본인을 제외한 모든 연결된 유저에게 instance_created 전송
export const fnBroadcastInstanceCreated = (objInstance: IEventInstance): void => {
  const nCreatorId = objInstance.objCreator?.nUserId ?? 0;
  for (const [nUserId, setClients] of mapClients.entries()) {
    if (nUserId === nCreatorId) continue;  // 생성자 본인은 로컬에서 이미 반영
    for (const res of setClients) {
      fnSendEvent(res, 'instance_created', objInstance);
    }
  }
};

// 이벤트 인스턴스 상태 변경 브로드캐스트
// - 관여자(생성자 + 처리자)에게는 전체 인스턴스 객체 전송 (instance_updated)
// - 나머지 연결된 유저에게는 가벼운 상태 변경 알림만 전송 (instance_status_changed)
export const fnBroadcastInstanceUpdate = (objInstance: IEventInstance): void => {
  // 관여자 ID 수집
  const setInvolvedUserIds = new Set<number>();
  const arrActorFields = [
    objInstance.objCreator,
    objInstance.objConfirmer,
    objInstance.objQaRequester,
    objInstance.objQaDeployer,
    objInstance.objQaVerifier,
    objInstance.objLiveRequester,
    objInstance.objLiveDeployer,
    objInstance.objLiveVerifier,
  ];
  for (const objActor of arrActorFields) {
    if (objActor?.nUserId) {
      setInvolvedUserIds.add(objActor.nUserId);
    }
  }

  // 상태 변경 요약 (가벼운 알림용)
  const objStatusUpdate = {
    nId: objInstance.nId,
    strStatus: objInstance.strStatus,
    strEventName: objInstance.strEventName,
    strProductName: objInstance.strProductName,
  };

  for (const [nUserId, setClients] of mapClients.entries()) {
    const strEvent = setInvolvedUserIds.has(nUserId) ? 'instance_updated' : 'instance_status_changed';
    const objPayload = setInvolvedUserIds.has(nUserId) ? objInstance : objStatusUpdate;

    for (const res of setClients) {
      fnSendEvent(res, strEvent, objPayload);
    }
  }
};

// 현재 연결된 클라이언트 수 (모니터링용)
export const fnGetClientCount = (): number => {
  let nCount = 0;
  for (const setClients of mapClients.values()) {
    nCount += setClients.size;
  }
  return nCount;
};
