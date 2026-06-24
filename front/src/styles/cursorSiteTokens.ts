/**
 * cursor.com / getdesign DESIGN.md 토큰 (hex·역할 이식)
 * @see https://cursor.com/
 * @see front/DESIGN.md (`npx getdesign@latest add cursor`)
 */

/** cursor.com Onyx Outline / Cursor Orange — useThemeStore STR_PRIMARY_CURSOR_BRAND 와 동일 값 유지 */
export const STR_CURSOR_SITE_ACCENT = '#f54e00';

/** hover·pressed (디자인 문서 관례) */
export const STR_CURSOR_SITE_ACCENT_HOVER = '#d04200';

/** 캔버스 Parchment */
export const STR_CURSOR_SITE_CANVAS = '#f7f7f4';

/** 잉크 Inkwell */
export const STR_CURSOR_SITE_INK = '#26251e';

/** Pebble / 카드·세그먼트 트랙 */
export const STR_CURSOR_SITE_PEBBLE = '#e6e5e0';

/** 크림 primary CTA 배경 (오렌지 면 채움 대신) */
export const STR_CURSOR_SITE_CREAM_BTN = '#ebeae5';

/** DESIGN.md body / muted */
export const STR_CURSOR_SITE_BODY = '#5a5852';
export const STR_CURSOR_SITE_MUTED = '#807d72';
export const STR_CURSOR_SITE_HAIRLINE = '#e6e5e0';

/** DESIGN.md semantic */
export const STR_CURSOR_SEMANTIC_ERROR = '#cf2d56';
export const STR_CURSOR_SEMANTIC_SUCCESS = '#1f8a65';

/** AI 타임라인 파스텔 (인스턴스 타임라인 등 확장용) */
export const OBJ_CURSOR_TIMELINE = {
  thinking: '#dfa88f',
  grep: '#9fc9a2',
  read: '#9fbbe0',
  edit: '#c0a8dd',
  done: '#c08532',
} as const;

const STR_INK_MUTED = 'rgba(38, 37, 30, 0.46)';
const STR_INK_BORDER = 'rgba(38, 37, 30, 0.10)';
const STR_INK_BORDER_STRONG = 'rgba(38, 37, 30, 0.14)';

/** design-system OBJ_CURSOR_NEUTRAL 과 동일 키 */
export type ICursorShellTokens = {
  strBgLayout: string;
  strBgContainer: string;
  strBgElevated: string;
  strBorder: string;
  strBorderSecondary: string;
  strSiderBg: string;
  strSiderBorder: string;
  strSiderLogoBorder: string;
  strSiderLogoText: string;
  strHeaderBg: string;
  strHeaderBorder: string;
  strContentPanelBorder: string;
  strMenuItemHover: string;
  strMenuItemSelected: string;
  strMenuItemColor: string;
  strMenuGroup: string;
  strSegmentedTrack: string;
  strScrollbarThumb: string;
};

export const OBJ_CURSOR_SITE_SHELL: { light: ICursorShellTokens } = {
  light: {
    strBgLayout: STR_CURSOR_SITE_CANVAS,
    strBgContainer: '#ffffff',
    strBgElevated: '#ffffff',
    strBorder: STR_INK_BORDER_STRONG,
    strBorderSecondary: STR_INK_BORDER,
    strSiderBg: STR_CURSOR_SITE_CANVAS,
    strSiderBorder: STR_INK_BORDER,
    strSiderLogoBorder: STR_INK_BORDER,
    strSiderLogoText: STR_CURSOR_SITE_BODY,
    strHeaderBg: STR_CURSOR_SITE_CANVAS,
    strHeaderBorder: STR_INK_BORDER,
    strContentPanelBorder: STR_INK_BORDER,
    strMenuItemHover: 'rgba(38, 37, 30, 0.06)',
    strMenuItemSelected: 'rgba(38, 37, 30, 0.08)',
    strMenuItemColor: STR_INK_MUTED,
    strMenuGroup: 'rgba(38, 37, 30, 0.42)',
    strSegmentedTrack: STR_CURSOR_SITE_PEBBLE,
    strScrollbarThumb: 'rgba(38, 37, 30, 0.22)',
  },
};

/** 라이트 + cursor.com 액센트(#f54e00)일 때 웜 셸 적용 */
export function fnIsCursorSitePrimary(strPrimary: string): boolean {
  return strPrimary.trim().toLowerCase() === STR_CURSOR_SITE_ACCENT.toLowerCase();
}

/** UI·코드용 폰트 스택 (CursorGothic 대체: Inter) */
export const STR_FONT_UI =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans KR', sans-serif";

export const STR_FONT_MONO =
  "'JetBrains Mono', 'Consolas', 'Monaco', ui-monospace, monospace";
