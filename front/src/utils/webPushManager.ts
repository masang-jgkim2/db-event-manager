import {
  fnApiDeletePushSubscribe,
  fnApiGetPushVapidPublicKey,
  fnApiPostPushSubscribe,
} from '../api/pushApi';
import {
  fnScopedStorageGetItem,
  fnScopedStorageRemoveItem,
  fnScopedStorageSetItem,
} from './userScopedStorage';

export const STR_UI_WEB_PUSH_ENABLED = 'db-event-manager-web-push-enabled';

const fnUrlBase64ToUint8Array = (strBase64: string): Uint8Array => {
  const strPadding = '='.repeat((4 - (strBase64.length % 4)) % 4);
  const strBase64Url = (strBase64 + strPadding).replace(/-/g, '+').replace(/_/g, '/');
  const strRaw = window.atob(strBase64Url);
  const arrOutput = new Uint8Array(strRaw.length);
  for (let nIdx = 0; nIdx < strRaw.length; nIdx++) {
    arrOutput[nIdx] = strRaw.charCodeAt(nIdx);
  }
  return arrOutput;
};

const fnIsLocalDevHost = (strHost: string): boolean => (
  strHost === 'localhost' || strHost === '127.0.0.1' || strHost === '[::1]'
);

export const fnGetWebPushUnsupportedReason = (): string | null => {
  if (typeof window === 'undefined') return null;
  if (window.isSecureContext) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return '이 브라우저는 Web Push를 지원하지 않습니다.';
    }
    return null;
  }
  const strHost = window.location.hostname;
  if (window.location.protocol === 'http:' && !fnIsLocalDevHost(strHost)) {
    return '브라우저 보안 정책으로 HTTP·IP 접속에서는 Web Push만 비활성입니다. 사이트·다른 기능은 그대로 쓸 수 있습니다. 알림 테스트는 이 PC의 localhost 또는 IP가 포함된 신뢰 HTTPS에서 하세요.';
  }
  return 'HTTPS 또는 localhost에서만 Web Push를 사용할 수 있습니다.';
};

export const fnIsWebPushSupported = (): boolean => fnGetWebPushUnsupportedReason() == null;

export const fnIsWebPushEnabledPref = (): boolean => (
  fnScopedStorageGetItem(STR_UI_WEB_PUSH_ENABLED) === '1'
);

const fnFlushPushUserUiPreferencesNow = async (): Promise<void> => {
  const objSync = await import('../services/userUiPreferencesSync');
  await objSync.fnFlushPushUserUiPreferencesNow();
};

const fnSetWebPushEnabledPref = async (bEnabled: boolean): Promise<void> => {
  if (bEnabled) {
    fnScopedStorageSetItem(STR_UI_WEB_PUSH_ENABLED, '1', false);
  } else {
    fnScopedStorageRemoveItem(STR_UI_WEB_PUSH_ENABLED, false);
  }
  await fnFlushPushUserUiPreferencesNow();
};

const fnGetServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration> => {
  let objReg = await navigator.serviceWorker.getRegistration('/');
  if (!objReg) {
    objReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }
  await navigator.serviceWorker.ready;
  return objReg;
};

const fnGetActiveSubscription = async (): Promise<PushSubscription | null> => {
  const objReg = await fnGetServiceWorkerRegistration();
  return objReg.pushManager.getSubscription();
};

const fnSubscribeWithVapid = async (strPublicKey: string): Promise<PushSubscription> => {
  const objReg = await fnGetServiceWorkerRegistration();
  const objKey = fnUrlBase64ToUint8Array(strPublicKey) as BufferSource;
  const objExisting = await objReg.pushManager.getSubscription();
  if (objExisting) {
    try {
      await objExisting.unsubscribe();
    } catch (err: unknown) {
      console.warn('[WebPush] 기존 구독 해제 실패 |', err);
    }
  }
  return objReg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: objKey,
  });
};

const fnPersistBrowserSubscription = async (objSub: PushSubscription): Promise<{
  bSuccess: boolean;
  strMessage?: string;
}> => {
  const objJson = objSub.toJSON();
  if (!objJson.endpoint || !objJson.keys?.p256dh || !objJson.keys?.auth) {
    return { bSuccess: false, strMessage: '구독 정보를 읽을 수 없습니다.' };
  }
  const objSaveRes = await fnApiPostPushSubscribe(objJson as PushSubscriptionJSON);
  if (!objSaveRes.bSuccess) {
    return { bSuccess: false, strMessage: objSaveRes.strMessage ?? '구독 저장에 실패했습니다.' };
  }
  return { bSuccess: true };
};

export const fnEnableWebPush = async (): Promise<{ bSuccess: boolean; strMessage?: string }> => {
  if (!fnIsWebPushSupported()) {
    return { bSuccess: false, strMessage: 'HTTPS 또는 localhost에서만 Web Push를 사용할 수 있습니다.' };
  }
  try {
    const objKeyRes = await fnApiGetPushVapidPublicKey();
    if (!objKeyRes.bSuccess || !objKeyRes.bEnabled || !objKeyRes.strPublicKey) {
      return { bSuccess: false, strMessage: '서버에 Web Push가 설정되지 않았습니다.' };
    }
    const strPermission = await Notification.requestPermission();
    if (strPermission !== 'granted') {
      return { bSuccess: false, strMessage: '브라우저 알림 권한이 거부되었습니다.' };
    }
    const objSub = await fnSubscribeWithVapid(objKeyRes.strPublicKey);
    const objPersistRes = await fnPersistBrowserSubscription(objSub);
    if (!objPersistRes.bSuccess) {
      try {
        await objSub.unsubscribe();
      } catch {
        /* 서버 저장 실패 시 브라우저 구독만 정리 */
      }
      return objPersistRes;
    }
    await fnSetWebPushEnabledPref(true);
    return { bSuccess: true };
  } catch (err: unknown) {
    const strMessage = err instanceof Error ? err.message : 'Web Push 구독에 실패했습니다.';
    console.error('[WebPush] 활성화 실패 |', err);
    return { bSuccess: false, strMessage };
  }
};

export const fnDisableWebPush = async (): Promise<void> => {
  await fnSetWebPushEnabledPref(false);
  const objSub = await fnGetActiveSubscription();
  if (!objSub) return;
  const strEndpoint = objSub.endpoint;
  try {
    await fnApiDeletePushSubscribe(strEndpoint);
  } catch (err: unknown) {
    console.warn('[WebPush] 서버 구독 해제 실패 |', err);
  }
  try {
    await objSub.unsubscribe();
  } catch (err: unknown) {
    console.warn('[WebPush] 브라우저 구독 해제 실패 |', err);
  }
};

export const fnGetWebPushEffectiveEnabled = async (): Promise<boolean> => {
  if (!fnIsWebPushEnabledPref()) return false;
  if (!fnIsWebPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const objSub = await fnGetActiveSubscription();
    return objSub != null;
  } catch (err: unknown) {
    console.warn('[WebPush] 구독 상태 확인 실패 |', err);
    return false;
  }
};

export const fnSyncWebPushAfterLogin = async (): Promise<void> => {
  if (!fnIsWebPushSupported() || !fnIsWebPushEnabledPref()) return;
  try {
    const objSub = await fnGetActiveSubscription();
    if (!objSub) return;
    await fnPersistBrowserSubscription(objSub);
  } catch (err: unknown) {
    console.warn('[WebPush] 로그인 후 구독 동기화 실패 |', err);
  }
};
