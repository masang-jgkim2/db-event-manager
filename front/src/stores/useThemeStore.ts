import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generate } from '@ant-design/colors';
import { useAuthStore } from './useAuthStore';

// 테마 모드 타입
export type TThemeMode = 'light' | 'dark';

/** Cursor 앱 UI 톤 — 중성 primary (Automations 등 회색·잉크 강조) */
export const STR_PRIMARY_CURSOR_NEUTRAL = '#434343';

/** Cursor 마케팅 브랜드 오렌지 (CTA·cursor.com) — 선택용 */
export const STR_PRIMARY_CURSOR_BRAND = '#f54e00';

// 포인트 컬러 팔레트 정의
export const ARR_PRIMARY_COLORS = [
  { strLabel: 'Cursor', strValue: STR_PRIMARY_CURSOR_NEUTRAL },
  { strLabel: '브랜드 오렌지', strValue: STR_PRIMARY_CURSOR_BRAND },
  { strLabel: '인디고', strValue: '#5B6ADF' },
  { strLabel: '퍼플 블루', strValue: '#667eea' },
  { strLabel: '블루', strValue: '#1677ff' },
  { strLabel: '사이언', strValue: '#13c2c2' },
  { strLabel: '그린', strValue: '#52c41a' },
  { strLabel: '오렌지', strValue: '#fa8c16' },
  { strLabel: '레드', strValue: '#f5222d' },
  { strLabel: '마젠타', strValue: '#eb2f96' },
  { strLabel: '바이올렛', strValue: '#722ed1' },
];

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
export function fnSiderMax(): number {
  return Math.floor(window.innerWidth / 3);
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

  fnGetIsDark: () => boolean;

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
    (set, get) => ({
      ...OBJ_DEFAULT,

      fnGetIsDark: () => get().strMode === 'dark',

      fnSetMode: (strMode) => set({ strMode }),
      fnSetSiderWidth: (nWidth, bClampMin = true) => {
        const nLo = bClampMin ? N_SIDER_MIN : N_SIDER_COLLAPSED_WIDTH;
        set({ nSiderWidth: Math.min(fnSiderMax(), Math.max(nLo, nWidth)) });
      },
      fnSetFontSize: (nSize) => set({ nFontSize: Math.min(25, Math.max(12, nSize)) }),
      fnSetCompact: (bCompact) => set({ bCompact }),
      fnSetPrimaryColor: (strColor) => set({ strPrimaryColor: strColor }),
      fnSetFunMode: (bFunMode) => set({ bFunMode }),
      fnReset: () => set({ ...OBJ_DEFAULT }),
    }),
    {
      name: 'db-event-manager-theme',
      storage: createJSONStorage(() => themePersistStorage),
      skipHydration: true,
      version: 1,
      migrate: (persisted) => {
        const obj = persisted as { strMode?: string };
        if (obj.strMode === 'system') {
          const bDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          return { ...obj, strMode: bDark ? 'dark' : 'light' };
        }
        return persisted;
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
