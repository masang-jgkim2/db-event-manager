import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generate } from '@ant-design/colors';
import { useAuthStore } from './useAuthStore';
import { STR_CURSOR_SITE_ACCENT } from '../styles/cursorSiteTokens';

// 테마 모드 타입
export type TThemeMode = 'light' | 'dark';

/** Cursor 앱 UI 톤 — 중성 primary (Automations 등 회색·잉크 강조) */
export const STR_PRIMARY_CURSOR_NEUTRAL = '#434343';

/** Cursor.com 마케팅 액센트 (CTA·링크) */
export const STR_PRIMARY_CURSOR_BRAND = STR_CURSOR_SITE_ACCENT;

/** UI 설정 포인트 컬러 — 3종만 노출 (디자인 시스템 정렬) */
export const STR_PRIMARY_ANT_BLUE = '#1677ff';

export const ARR_PRIMARY_COLORS = [
  { strLabel: 'Cursor IDE', strValue: STR_PRIMARY_CURSOR_NEUTRAL },
  { strLabel: 'Cursor.com', strValue: STR_PRIMARY_CURSOR_BRAND },
  { strLabel: '블루', strValue: STR_PRIMARY_ANT_BLUE },
] as const;

const SET_ALLOWED_PRIMARY = new Set<string>(ARR_PRIMARY_COLORS.map((obj) => obj.strValue));

/** 저장값이 구 팔레트(인디고 등)이면 허용 3색 중 하나로 보정 */
export function fnNormalizePrimaryColor(strColor: string): string {
  if (SET_ALLOWED_PRIMARY.has(strColor)) return strColor;
  return STR_PRIMARY_CURSOR_NEUTRAL;
}

// primary 컬러 하나로 10단계 팔레트를 생성한다
// generate()[5] = primary (index 5, 6번째), [0]~[4] = 밝은 계열, [6]~[9] = 어두운 계열
export function fnGenPalette(strPrimary: string, bDark = false): string[] {
  return generate(strPrimary, bDark ? { theme: 'dark', backgroundColor: '#141414' } : undefined);
}

// 사이드바 너비 — Ant Design collapsed 폭(80)과 맞춤
export const N_SIDER_COLLAPSED_WIDTH = 80;
/** 드래그·펼침 시 최소 너비(이하로 당기면 아이콘 모드) */
export const N_SIDER_MIN = 160;
/** 더블클릭·초기화 시 기본 너비 */
export const N_SIDER_DEFAULT = 200;
/** 펼침 드래그 후 mouseup — 이보다 좁으면 다시 아이콘 모드 */
export const N_SIDER_EXPAND_RELEASE = N_SIDER_COLLAPSED_WIDTH + 28;

export function fnSiderMax(): number {
  return Math.floor(window.innerWidth / 3);
}

export function fnClampSiderWidth(nWidth: number, bClampMin = true): number {
  const nLo = bClampMin ? N_SIDER_MIN : N_SIDER_COLLAPSED_WIDTH;
  return Math.min(fnSiderMax(), Math.max(nLo, nWidth));
}

// 기본값
const OBJ_DEFAULT = {
  strMode: 'light' as TThemeMode,
  nSiderWidth: N_SIDER_DEFAULT,
  nFontSize: 14,
  bCompact: false,
  strPrimaryColor: STR_PRIMARY_CURSOR_NEUTRAL,
  bFunMode: false, // 재미 모드: 재요청 버튼을 롱프레스로 전환
};

interface IThemeStore {
  strMode: TThemeMode;
  nSiderWidth: number;
  nFontSize: number;
  bCompact: boolean;
  strPrimaryColor: string;
  bFunMode: boolean;

  // 액션
  fnSetMode: (strMode: TThemeMode) => void;
  /** bClampMin=false: 드래그로 펼칠 때 80~160 사이도 따라감(릴리스 시 보정) */
  fnSetSiderWidth: (nWidth: number, bClampMin?: boolean) => void;
  fnSetFontSize: (nSize: number) => void;
  fnSetCompact: (bCompact: boolean) => void;
  fnSetPrimaryColor: (strColor: string) => void;
  fnSetFunMode: (bFunMode: boolean) => void;
  fnReset: () => void;
}

const themePersistStorage = {
  getItem: (strName: string): string | null => {
    const nId = useAuthStore.getState().user?.nId ?? 0;
    const strKey = nId > 0 ? `dbem:u${nId}:${strName}` : `dbem:guest:${strName}`;
    return localStorage.getItem(strKey);
  },
  setItem: (strName: string, strValue: string): void => {
    const nId = useAuthStore.getState().user?.nId ?? 0;
    const strKey = nId > 0 ? `dbem:u${nId}:${strName}` : `dbem:guest:${strName}`;
    localStorage.setItem(strKey, strValue);
    if (nId > 0) {
      void import('../services/userUiPreferencesSync').then((m) => m.fnSchedulePushUserUiPreferences());
    }
  },
  removeItem: (strName: string): void => {
    const nId = useAuthStore.getState().user?.nId ?? 0;
    const strKey = nId > 0 ? `dbem:u${nId}:${strName}` : `dbem:guest:${strName}`;
    localStorage.removeItem(strKey);
    if (nId > 0) {
      void import('../services/userUiPreferencesSync').then((m) => m.fnSchedulePushUserUiPreferences());
    }
  },
};

export const useThemeStore = create<IThemeStore>()(
  persist(
    (set) => ({
      ...OBJ_DEFAULT,

      fnSetMode: (strMode) => set({ strMode }),
      fnSetSiderWidth: (nWidth, bClampMin = true) => {
        set({ nSiderWidth: fnClampSiderWidth(nWidth, bClampMin) });
      },
      fnSetFontSize: (nSize) => set({ nFontSize: Math.min(25, Math.max(12, nSize)) }),
      fnSetCompact: (bCompact) => set({ bCompact }),
      fnSetPrimaryColor: (strColor) => set({ strPrimaryColor: fnNormalizePrimaryColor(strColor) }),
      fnSetFunMode: (bFunMode) => set({ bFunMode }),
      fnReset: () => set({ ...OBJ_DEFAULT }),
    }),
    {
      name: 'db-event-manager-theme',
      storage: createJSONStorage(() => themePersistStorage),
      skipHydration: true,
      version: 2,
      migrate: (persisted, nVersion) => {
        const obj = { ...(persisted as Record<string, unknown>) };
        if (nVersion < 1 && obj.strMode === 'system') {
          const bDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          obj.strMode = bDark ? 'dark' : 'light';
        }
        if (typeof obj.strPrimaryColor === 'string') {
          obj.strPrimaryColor = fnNormalizePrimaryColor(obj.strPrimaryColor);
        }
        return obj;
      },
      partialize: (state) => ({
        strMode: state.strMode,
        nSiderWidth: state.nSiderWidth,
        nFontSize: state.nFontSize,
        bCompact: state.bCompact,
        strPrimaryColor: state.strPrimaryColor,
        bFunMode: state.bFunMode,
      }),
    },
  ),
);
