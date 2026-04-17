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

  // 상태 변경 요약 (가벼운 알림용) — 영구 삭제는 strStatus가 그대로이므로 bPermanentlyRemoved 반드시 포함
  const objStatusUpdate = {
    nId: objInstance.nId,
    strStatus: objInstance.strStatus,
    strEventName: objInstance.strEventName,
    strProductName: objInstance.strProductName,
    bPermanentlyRemoved: Boolean(objInstance.bPermanentlyRemoved),
    dtPermanentlyRemovedAt: objInstance.dtPermanentlyRemovedAt,
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

// ── 활동 로그 SSE (activity.view 전용, 인스턴스 스트림과 분리) ──
const mapActivityStreamClients = new Map<number, Set<Response>>();

export const fnRegisterActivityStreamClient = (nUserId: number, res: Response): void => {
  if (!mapActivityStreamClients.has(nUserId)) {
    mapActivityStreamClients.set(nUserId, new Set());
  }
  mapActivityStreamClients.get(nUserId)!.add(res);
};

export const fnUnregisterActivityStreamClient = (nUserId: number, res: Response): void => {
  const setClients = mapActivityStreamClients.get(nUserId);
  if (setClients) {
    setClients.delete(res);
    if (setClients.size === 0) {
      mapActivityStreamClients.delete(nUserId);
    }
  }
};

/** 신규 활동 로그 1건이 쌓일 때 연결된 클라이언트 전원에게 푸시 */
export const fnBroadcastActivityLog = (objData: unknown): void => {
  for (const setClients of mapActivityStreamClients.values()) {
    for (const res of setClients) {
      fnSendEvent(res, 'activity_log_appended', objData);
    }
  }
};

// ── 사용자 접속 상태 SSE (user.view) ──
const mapUserPresenceStreamClients = new Map<number, Set<Response>>();

export const fnRegisterUserPresenceStreamClient = (nUserId: number, res: Response): void => {
  if (!mapUserPresenceStreamClients.has(nUserId)) {
    mapUserPresenceStreamClients.set(nUserId, new Set());
  }
  mapUserPresenceStreamClients.get(nUserId)!.add(res);
};

export const fnUnregisterUserPresenceStreamClient = (nUserId: number, res: Response): void => {
  const setClients = mapUserPresenceStreamClients.get(nUserId);
  if (setClients) {
    setClients.delete(res);
    if (setClients.size === 0) {
      mapUserPresenceStreamClients.delete(nUserId);
    }
  }
};

/** 단일 사용자 접속 상태 변경 시 구독자 전원에게 푸시 */
export const fnBroadcastUserPresence = (objPayload: {
  nUserId: number;
  bOnline: boolean;
  strLastSeenAt: string | null;
}): void => {
  for (const setClients of mapUserPresenceStreamClients.values()) {
    for (const res of setClients) {
      fnSendEvent(res, 'user_presence', objPayload);
    }
  }
};
