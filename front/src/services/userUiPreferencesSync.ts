import { fnApiGetUiPreferences, fnApiPutUiPreferences } from '../api/userUiPreferencesApi';
import { useAuthStore } from '../stores/useAuthStore';
import { useThemeStore } from '../stores/useThemeStore';
import { useEventInstanceStore } from '../stores/useEventInstanceStore';
import {
  fnApplyPulledUiEntries,
  fnCollectScopedEntriesForUser,
  fnMigrateLegacyUiKeysToScoped,
  fnScopedStorageGetItem,
} from '../utils/userScopedStorage';

const N_PUSH_DEBOUNCE_MS = 2_000;

let nPushTimer: ReturnType<typeof setTimeout> | null = null;

const fnDoPush = async (): Promise<void> => {
  nPushTimer = null;
  const nUserId = useAuthStore.getState().user?.nId ?? 0;
  if (nUserId <= 0) return;
  const objEntries = fnCollectScopedEntriesForUser(nUserId);
  try {
    await fnApiPutUiPreferences(objEntries);
  } catch (err: unknown) {
    console.warn('[UI동기화] 서버 저장 실패 |', err);
  }
};

/** 스코프 localStorage 변경 후 디바운스 PUT */
export const fnSchedulePushUserUiPreferences = (): void => {
  const nUserId = useAuthStore.getState().user?.nId ?? 0;
  if (nUserId <= 0) return;
  if (nPushTimer != null) window.clearTimeout(nPushTimer);
  nPushTimer = window.setTimeout(() => void fnDoPush(), N_PUSH_DEBOUNCE_MS);
};

const fnLoadHiddenSetAfterPull = (): Set<number> => {
  try {
    const strRaw = fnScopedStorageGetItem('db-event-manager-hidden-ids');
    return strRaw ? new Set<number>(JSON.parse(strRaw) as number[]) : new Set();
  } catch {
    return new Set();
  }
};

/** 로그인 직후: 레거시 이관 → 서버에서 당겨오기 → 테마·숨김 목록 반영 */
export const fnRunUiPreferencesPullForUser = async (nUserId: number): Promise<void> => {
  if (nUserId <= 0) return;
  fnMigrateLegacyUiKeysToScoped(nUserId);
  let bHadServerData = false;
  try {
    const objRes = await fnApiGetUiPreferences();
    if (objRes.bSuccess && objRes.objEntries && typeof objRes.objEntries === 'object') {
      bHadServerData = Object.keys(objRes.objEntries).length > 0;
      fnApplyPulledUiEntries(nUserId, objRes.objEntries);
    }
  } catch (err: unknown) {
    console.warn('[UI동기화] 서버 로드 실패(로컬만 사용) |', err);
  }
  if (!bHadServerData) {
    const objLocal = fnCollectScopedEntriesForUser(nUserId);
    if (Object.keys(objLocal).length > 0) {
      try {
        await fnApiPutUiPreferences(objLocal);
      } catch {
        /* 시드 실패는 이후 변경 시 재시도 */
      }
    }
  }
  await useThemeStore.persist.rehydrate();
  useEventInstanceStore.setState({ setHiddenIds: fnLoadHiddenSetAfterPull() });
};
