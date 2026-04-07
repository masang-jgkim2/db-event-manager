import { useAuthStore } from '../stores/useAuthStore';

const STR_PREFIX = 'dbem';

/** 레거시(출처 공용) 키 → 최초 1회 계정 스코프로 복사 */
export const ARR_LEGACY_UI_STATIC_KEYS: string[] = [
  'db-event-manager-theme',
  'db-event-manager-dashboard-cards',
  'db-event-manager-dashboard-card-sizes',
  'db-event-manager-dashboard-card-order',
  'db-event-manager-dashboard-table-size',
  'db-event-manager-dashboard-custom-cards',
  'db-event-manager-dashboard-custom-collapse',
  'db-event-manager-hidden-ids',
];

export const fnScopedStorageFullKey = (strLogicalKey: string, nUserId: number): string => {
  if (nUserId <= 0) return `${STR_PREFIX}:guest:${strLogicalKey}`;
  return `${STR_PREFIX}:u${nUserId}:${strLogicalKey}`;
};

const fnCurrentUserId = (): number => useAuthStore.getState().user?.nId ?? 0;

/** 인증된 화면용 — logical key만 넘김 */
export const fnScopedStorageGetItem = (strLogicalKey: string): string | null => {
  const nId = fnCurrentUserId();
  if (nId <= 0) return null;
  return localStorage.getItem(fnScopedStorageFullKey(strLogicalKey, nId));
};

export const fnScopedStorageSetItem = (strLogicalKey: string, strValue: string, bScheduleSync = true): void => {
  const nId = fnCurrentUserId();
  if (nId <= 0) return;
  localStorage.setItem(fnScopedStorageFullKey(strLogicalKey, nId), strValue);
  if (bScheduleSync) {
    void import('../services/userUiPreferencesSync').then((m) => m.fnSchedulePushUserUiPreferences());
  }
};

export const fnScopedStorageRemoveItem = (strLogicalKey: string, bScheduleSync = true): void => {
  const nId = fnCurrentUserId();
  if (nId <= 0) return;
  localStorage.removeItem(fnScopedStorageFullKey(strLogicalKey, nId));
  if (bScheduleSync) {
    void import('../services/userUiPreferencesSync').then((m) => m.fnSchedulePushUserUiPreferences());
  }
};

const ARR_LEGACY_PREFIXES = [
  'app_table_col_order_',
  'app_table_col_width_',
  'app_table_col_visible_',
  'dashboard_skip_confirm_',
] as const;

/** 기존 비스코프 키를 현재 계정 스코프로 한 번만 이관 */
export const fnMigrateLegacyUiKeysToScoped = (nUserId: number): void => {
  if (nUserId <= 0 || typeof localStorage === 'undefined') return;

  for (const strLogical of ARR_LEGACY_UI_STATIC_KEYS) {
    const strScoped = fnScopedStorageFullKey(strLogical, nUserId);
    if (localStorage.getItem(strScoped) != null) continue;
    const strLegacy = localStorage.getItem(strLogical);
    if (strLegacy != null) localStorage.setItem(strScoped, strLegacy);
  }

  const arrKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const strK = localStorage.key(i);
    if (strK) arrKeys.push(strK);
  }
  for (const strK of arrKeys) {
    if (ARR_LEGACY_PREFIXES.some((p) => strK.startsWith(p))) {
      const strScoped = fnScopedStorageFullKey(strK, nUserId);
      if (localStorage.getItem(strScoped) != null) continue;
      const strVal = localStorage.getItem(strK);
      if (strVal != null) localStorage.setItem(strScoped, strVal);
    }
  }
};

export const fnCollectScopedEntriesForUser = (nUserId: number): Record<string, string> => {
  const strPrefix = `${STR_PREFIX}:u${nUserId}:`;
  const objOut: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const strK = localStorage.key(i);
    if (!strK || !strK.startsWith(strPrefix)) continue;
    const strLogical = strK.slice(strPrefix.length);
    const strVal = localStorage.getItem(strK);
    if (strVal != null) objOut[strLogical] = strVal;
  }
  return objOut;
};

/** 서버에서 받은 맵을 localStorage에 씀(푸시 스케줄 없음) */
export const fnApplyPulledUiEntries = (nUserId: number, objEntries: Record<string, string>): void => {
  if (nUserId <= 0) return;
  for (const [strLogical, strVal] of Object.entries(objEntries)) {
    if (typeof strVal !== 'string') continue;
    localStorage.setItem(fnScopedStorageFullKey(strLogical, nUserId), strVal);
  }
};
