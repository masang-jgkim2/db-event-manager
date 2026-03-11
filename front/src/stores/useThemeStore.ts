import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generate } from '@ant-design/colors';

// 테마 모드 타입
export type TThemeMode = 'light' | 'dark' | 'system';

// 포인트 컬러 팔레트 정의
export const ARR_PRIMARY_COLORS = [
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

// 사이드바 너비 한계: 최소 160px, 최대 화면 너비의 1/3 (동적)
export const N_SIDER_MIN = 160;
export function fnSiderMax(): number {
  return Math.floor(window.innerWidth / 3);
}

// 기본값
const OBJ_DEFAULT = {
  strMode: 'light' as TThemeMode,
  nSiderWidth: 200,
  nFontSize: 14,
  bCompact: false,
  strPrimaryColor: '#667eea',
  bFunMode: false, // 재미 모드: 재요청 버튼을 롱프레스로 전환
};

interface IThemeStore {
  strMode: TThemeMode;
  nSiderWidth: number;
  nFontSize: number;
  bCompact: boolean;
  strPrimaryColor: string;
  bFunMode: boolean;

  // 시스템 다크모드 여부 (system 모드일 때 OS 설정 반영)
  fnGetIsDark: () => boolean;

  // 액션
  fnSetMode: (strMode: TThemeMode) => void;
  fnSetSiderWidth: (nWidth: number) => void;
  fnSetFontSize: (nSize: number) => void;
  fnSetCompact: (bCompact: boolean) => void;
  fnSetPrimaryColor: (strColor: string) => void;
  fnSetFunMode: (bFunMode: boolean) => void;
  fnReset: () => void;
}

export const useThemeStore = create<IThemeStore>()(
  persist(
    (set, get) => ({
      ...OBJ_DEFAULT,

      // OS 다크모드 감지 포함한 실제 다크 여부
      fnGetIsDark: () => {
        const { strMode } = get();
        if (strMode === 'dark') return true;
        if (strMode === 'light') return false;
        // system: OS prefers-color-scheme 감지
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      },

      fnSetMode: (strMode) => set({ strMode }),
      fnSetSiderWidth: (nWidth) => set({ nSiderWidth: Math.min(fnSiderMax(), Math.max(N_SIDER_MIN, nWidth)) }),
      fnSetFontSize: (nSize) => set({ nFontSize: Math.min(25, Math.max(12, nSize)) }),
      fnSetCompact: (bCompact) => set({ bCompact }),
      fnSetPrimaryColor: (strColor) => set({ strPrimaryColor: strColor }),
      fnSetFunMode: (bFunMode) => set({ bFunMode }),
      fnReset: () => set({ ...OBJ_DEFAULT }),
    }),
    {
      name: 'db-event-manager-theme',
    },
  ),
);
