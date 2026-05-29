/**
 * design-system.ts
 * primary 컬러 하나를 입력받아 앱 전체에서 사용하는
 * 디자인 토큰(색상·타이포·간격)을 일관되게 생성한다.
 *
 * 구조:
 *  fnBuildDesignSystem(strPrimary, bDark, nFontSize)
 *    → { antdToken, objSider, objHeader, objMenu, ... }
 *
 * 각 섹션은 해당 UI 영역에 직접 인라인 스타일 또는
 * Ant Design ConfigProvider token/components 로 주입된다.
 */

import { generate } from '@ant-design/colors';

/** Cursor IDE에 가까운 중성 톤 (테마·셸 — 정교화 v2) */
const OBJ_CURSOR_NEUTRAL = {
  light: {
    strBgLayout: '#F5F5F5',
    strBgContainer: '#FFFFFF',
    strBgElevated: '#FFFFFF',
    strBorder: '#E0E0E0',
    strBorderSecondary: '#ECECEC',
    strSiderBg: '#F3F3F3',
    strSiderBorder: '#E5E5E5',
    strSiderLogoBorder: '#E5E5E5',
    strSiderLogoText: 'rgba(0, 0, 0, 0.90)',
    strHeaderBg: '#F3F3F3',
    strHeaderBorder: '#E5E5E5',
    strContentPanelBorder: '#E5E5E5',
    strMenuItemHover: 'rgba(0, 0, 0, 0.05)',
    strMenuItemSelected: 'rgba(0, 0, 0, 0.08)',
    strMenuItemColor: 'rgba(0, 0, 0, 0.68)',
    strMenuGroup: 'rgba(0, 0, 0, 0.42)',
    strSegmentedTrack: '#EBEBEB',
    strScrollbarThumb: 'rgba(0, 0, 0, 0.22)',
  },
  dark: {
    strBgLayout: '#1E1E1E',
    strBgContainer: '#252526',
    strBgElevated: '#2D2D30',
    strBorder: 'rgba(255, 255, 255, 0.10)',
    strBorderSecondary: 'rgba(255, 255, 255, 0.08)',
    strSiderBg: '#252526',
    strSiderBorder: 'rgba(255, 255, 255, 0.08)',
    strSiderLogoBorder: 'rgba(255, 255, 255, 0.08)',
    strSiderLogoText: 'rgba(255, 255, 255, 0.92)',
    strHeaderBg: '#252526',
    strHeaderBorder: 'rgba(255, 255, 255, 0.08)',
    strContentPanelBorder: 'rgba(255, 255, 255, 0.08)',
    strMenuItemHover: 'rgba(255, 255, 255, 0.06)',
    strMenuItemSelected: 'rgba(255, 255, 255, 0.10)',
    strMenuItemColor: 'rgba(255, 255, 255, 0.76)',
    strMenuGroup: 'rgba(255, 255, 255, 0.42)',
    strSegmentedTrack: '#2D2D30',
    strScrollbarThumb: 'rgba(255, 255, 255, 0.28)',
  },
} as const;

const STR_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans KR', sans-serif";

// ─── 팔레트 인덱스 상수 ───────────────────────────────────────
const IDX_BG         = 0;   // 가장 밝은 배경 (선택 배경, 테이블 헤더)
const IDX_BORDER     = 2;   // 테두리
const IDX_HOVER      = 4;   // hover foreground
const IDX_PRIMARY    = 5;   // primary (기준색)
const IDX_ACTIVE     = 6;   // pressed/active
const IDX_DARK1      = 7;   // 진한 계열 1
const IDX_DARK2      = 8;   // 진한 계열 2
const IDX_DARKEST    = 9;   // 가장 진한 계열

// ─── 색대비를 고려한 텍스트 색 선택 ────────────────────────────
// hex → luminance → 밝으면 dark text, 어두우면 light text
function fnLuminance(strHex: string): number {
  const strClean = strHex.replace('#', '');
  const nR = parseInt(strClean.slice(0, 2), 16) / 255;
  const nG = parseInt(strClean.slice(2, 4), 16) / 255;
  const nB = parseInt(strClean.slice(4, 6), 16) / 255;
  const fnC = (n: number) => n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  return 0.2126 * fnC(nR) + 0.7152 * fnC(nG) + 0.0722 * fnC(nB);
}

function fnContrastText(strBg: string): string {
  // color-mix는 직접 파싱 불가 → 단순 어두운 배경 가정으로 흰색 반환
  if (strBg.startsWith('color-mix')) return 'rgba(255,255,255,0.92)';
  return fnLuminance(strBg) > 0.179 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)';
}

// ─── 타이포그래피 스케일 ─────────────────────────────────────
// nFontSize(기준)를 기반으로 비율별 크기 생성
export interface ITypographyScale {
  nXs:   number;  // 0.75 × base — 보조 라벨, timestamp
  nSm:   number;  // 0.875 × base — 테이블 셀 보조
  nBase: number;  // 1.0 × base — 기본 본문
  nMd:   number;  // 1.125 × base — 소제목
  nLg:   number;  // 1.25 × base — 제목
  nXl:   number;  // 1.5 × base — 페이지 제목
  nXxl:  number;  // 2.0 × base — 숫자 통계
}

function fnBuildTypography(nBase: number): ITypographyScale {
  const n = (ratio: number) => Math.round(nBase * ratio * 10) / 10;
  return {
    nXs:   n(0.75),
    nSm:   n(0.875),
    nBase: nBase,
    nMd:   n(1.125),
    nLg:   n(1.25),
    nXl:   n(1.5),
    nXxl:  n(2.0),
  };
}

// ─── 간격 스케일 ────────────────────────────────────────────
// nFontSize에 비례한 spacing
export interface ISpacingScale {
  nXs:  number;   // 4px 계열
  nSm:  number;   // 8px 계열
  nMd:  number;   // 12px 계열
  nLg:  number;   // 16px 계열
  nXl:  number;   // 24px 계열
  nXxl: number;   // 32px 계열
}

function fnBuildSpacing(nBase: number): ISpacingScale {
  const nUnit = Math.round(nBase * 0.3); // base=14 → unit≈4
  return {
    nXs:  nUnit,
    nSm:  nUnit * 2,
    nMd:  nUnit * 3,
    nLg:  nUnit * 4,
    nXl:  nUnit * 6,
    nXxl: nUnit * 8,
  };
}

// ─── 전체 디자인 시스템 출력 타입 ────────────────────────────

export interface IDesignSystem {
  // ── Ant Design ConfigProvider token / components 에 주입할 전체 설정
  antdThemeConfig: {
    token: Record<string, unknown>;
    components: Record<string, Record<string, unknown>>;
  };

  // ── 사이드바 인라인 스타일 토큰
  objSider: {
    strBackground: string;       // 사이드바 배경
    strLogoBackground: string;   // 로고 영역 배경
    strLogoBorder: string;       // 로고 아래 구분선
    strLogoText: string;         // 사이드바 로고 텍스트 색
    nLogoFontSize: number;       // 로고 폰트 크기 (px)
    nLogoFontWeight: number;     // 로고 폰트 굵기
    strResizeHandle: string;     // 드래그 핸들 hover 색
  };

  // ── 헤더 인라인 스타일 토큰
  objHeader: {
    strBackground: string;       // 헤더 배경
    strBorder: string;           // 하단 구분선
    strText: string;             // 헤더 텍스트
  };

  // ── 메뉴 그룹 제목 스타일 토큰
  objMenuGroup: {
    strColor: string;            // 그룹 레이블 색 (이벤트/사용자/운영)
    nFontSize: number;           // 그룹 레이블 폰트 크기
    nFontWeight: number;         // 그룹 레이블 굵기
    strLetterSpacing: string;    // 자간
    strTextTransform: string;    // 대소문자
  };

  /** 메인 셸(MainLayout) — Cursor 스타일 레이아웃 토큰 */
  objShell: {
    strMenuTheme: 'light' | 'dark';
    strContentBg: string;
    strSiderBorder: string;
    strContentPanelBg: string;
    strContentPanelBorder: string;
    nContentPanelRadius: number;
    nHeaderHeight: number;
    nLogoHeight: number;
  };

  // ── 타이포그래피 스케일
  objTypo: ITypographyScale;

  // ── 간격 스케일
  objSpacing: ISpacingScale;

  // ── 팔레트 (10단계)
  arrPalette: string[];

  // ── 자주 쓰는 컬러 단축
  objColor: {
    strPrimary:       string;
    strPrimaryBg:     string;
    strPrimaryHover:  string;
    strPrimaryActive: string;
    strPrimaryBorder: string;
    strPrimaryText:   string;
    strLink:          string;
    strLinkHover:     string;
    strSuccess:       string;
    strWarning:       string;
    strError:         string;
    strInfo:          string;
  };
}

// ─── 메인 빌더 함수 ──────────────────────────────────────────
export function fnBuildDesignSystem(
  strPrimary: string,
  bDark: boolean,
  nFontSize: number,
): IDesignSystem {
  // 팔레트 생성
  const arrP = generate(strPrimary, bDark ? { theme: 'dark', backgroundColor: '#141414' } : undefined);

  // 타이포/스페이싱
  const objTypo    = fnBuildTypography(nFontSize);
  const objSpacing = fnBuildSpacing(nFontSize);

  const objCursor = bDark ? OBJ_CURSOR_NEUTRAL.dark : OBJ_CURSOR_NEUTRAL.light;

  // ── 사이드바·헤더 (Cursor 중성 톤, 다크는 기존 primary 믹스 폴백) ──
  const strSiderBg = objCursor.strSiderBg;
  const strSiderLogoText = objCursor.strSiderLogoText;
  const strSiderLogoBorder = objCursor.strSiderLogoBorder;
  const strResizeHandle = bDark
    ? 'rgba(255,255,255,0.18)'
    : `color-mix(in srgb, ${arrP[IDX_PRIMARY]} 35%, #000000 65%)`;

  const strHeaderBg = objCursor.strHeaderBg;
  const strHeaderBorder = objCursor.strHeaderBorder;
  const strHeaderText = bDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.88)';

  const strMenuGroupColor = objCursor.strMenuGroup;
  const nMenuGroupFontSize = Math.max(objTypo.nXs, 10);

  const nHeaderHeight = 44;
  const nLogoHeight = 44;
  const nContentPanelRadius = 10;

  const strPrimaryBgSubtle = bDark
    ? `color-mix(in srgb, ${strPrimary} 22%, transparent)`
    : `color-mix(in srgb, ${strPrimary} 12%, #ffffff)`;

  // ── Ant Design 컴포넌트 토큰 ─────────────────────────────
  const antdToken: Record<string, unknown> = {
    fontFamily: STR_FONT_FAMILY,
    lineHeight: 1.5,
    fontWeightStrong: 600,

    colorBgLayout:       objCursor.strBgLayout,
    colorBgContainer:    objCursor.strBgContainer,
    colorBgElevated:     objCursor.strBgElevated,
    colorBorder:         objCursor.strBorder,
    colorBorderSecondary: objCursor.strBorderSecondary,
    colorText:           bDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.88)',
    colorTextSecondary:  bDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
    colorTextTertiary:   bDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
    colorFillAlter:      bDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    colorFillSecondary:  bDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',

    colorSplit:          objCursor.strBorderSecondary,

    // 기본 색 — primary는 포인트만, 배경 선택은 중성+살짝 primary
    colorPrimary:        strPrimary,
    colorPrimaryBg:      strPrimaryBgSubtle,
    colorPrimaryBgHover: bDark
      ? `color-mix(in srgb, ${strPrimary} 28%, transparent)`
      : `color-mix(in srgb, ${strPrimary} 16%, #ffffff)`,
    colorPrimaryBorder:  bDark ? objCursor.strBorder : `color-mix(in srgb, ${strPrimary} 35%, ${objCursor.strBorder})`,
    colorPrimaryHover:   arrP[IDX_HOVER],
    colorPrimaryActive:  arrP[IDX_ACTIVE],
    colorPrimaryText:    arrP[IDX_PRIMARY],
    colorPrimaryTextHover: arrP[IDX_HOVER],

    // 링크
    colorLink:       arrP[IDX_PRIMARY],
    colorLinkHover:  arrP[IDX_HOVER],
    colorLinkActive: arrP[IDX_ACTIVE],

    // 상태 색 (primary 기반 채도 조정)
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError:   '#ff4d4f',
    colorInfo:    arrP[IDX_PRIMARY],

    // 타이포그래피
    fontSize:       objTypo.nBase,
    fontSizeSM:     objTypo.nSm,
    fontSizeLG:     objTypo.nLg,
    fontSizeXL:     objTypo.nXl,
    fontSizeHeading1: objTypo.nXxl,
    fontSizeHeading2: objTypo.nXl,
    fontSizeHeading3: objTypo.nLg,
    fontSizeHeading4: objTypo.nMd,
    fontSizeHeading5: objTypo.nBase,

    // 간격
    padding:    objSpacing.nLg,
    paddingSM:  objSpacing.nSm,
    paddingMD:  objSpacing.nMd,
    paddingLG:  objSpacing.nXl,
    paddingXL:  objSpacing.nXxl,
    margin:     objSpacing.nLg,
    marginSM:   objSpacing.nSm,
    marginMD:   objSpacing.nMd,
    marginLG:   objSpacing.nXl,
    marginXL:   objSpacing.nXxl,

    // 테두리 반경 — Cursor 스타일(부드러운 모서리)
    borderRadius:   8,
    borderRadiusSM: 6,
    borderRadiusLG: 10,
    borderRadiusXL: 12,

    lineWidth: 1,
    lineType: 'solid',

    // 높이 — Cursor UI는 컴팩트한 컨트롤(약 32px @14px)
    controlHeight:   Math.max(32, Math.round(nFontSize * 2.29)),
    controlHeightSM: Math.max(24, Math.round(nFontSize * 1.71)),
    controlHeightLG: Math.max(40, Math.round(nFontSize * 2.86)),

    controlOutline: bDark
      ? `color-mix(in srgb, ${strPrimary} 40%, transparent)`
      : `color-mix(in srgb, ${strPrimary} 22%, transparent)`,

    motionDurationMid: '0.15s',
    motionDurationSlow: '0.22s',

    // 그림자 — 카드·드롭다운만, 버튼은 플랫
    boxShadow:          'none',
    boxShadowSecondary: bDark
      ? '0 8px 28px rgba(0,0,0,0.5)'
      : '0 6px 20px rgba(0,0,0,0.08)',
    boxShadowTertiary:  bDark
      ? '0 2px 8px rgba(0,0,0,0.35)'
      : '0 1px 4px rgba(0,0,0,0.06)',
  };

  // ── 컴포넌트별 세부 토큰 ─────────────────────────────────
  const antdComponents: Record<string, Record<string, unknown>> = {
    // 메뉴 (사이드바) — 라이트: Cursor 밝은 네비 / 다크: VS Code·Cursor 다크 톤
    Menu: {
      itemBg:                 'transparent',
      subMenuItemBg:          'transparent',
      itemColor:              objCursor.strMenuItemColor,
      itemHoverBg:            objCursor.strMenuItemHover,
      itemHoverColor:         bDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)',
      itemSelectedBg:         objCursor.strMenuItemSelected,
      itemSelectedColor:      bDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.90)',
      itemMarginInline:       4,
      itemPaddingInline:        10,
      itemActiveBg:           objCursor.strMenuItemSelected,
      activeBarWidth:         0,
      groupTitleColor:        strMenuGroupColor,
      darkItemBg:             'transparent',
      darkSubMenuItemBg:      'transparent',
      darkItemSelectedBg:     objCursor.strMenuItemSelected,
      darkItemSelectedColor:  bDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.88)',
      darkItemHoverBg:        objCursor.strMenuItemHover,
      darkItemHoverColor:     bDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)',
      darkGroupTitleColor:    strMenuGroupColor,
      groupTitleFontSize:     nMenuGroupFontSize,
      groupTitleLineHeight:   1.5,
      itemHeight:             Math.max(32, Math.round(nFontSize * 2.29)),
      iconSize:               Math.round(nFontSize * 1.07),
      fontSize:               objTypo.nBase,
      itemBorderRadius:       6,
    },

    // 테이블
    Table: {
      headerBg:              bDark ? objCursor.strBgElevated : objCursor.strBgContainer,
      headerColor:           bDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.58)',
      headerSortActiveBg:    objCursor.strMenuItemHover,
      borderColor:           objCursor.strBorderSecondary,
      rowHoverBg:            objCursor.strMenuItemHover,
      rowSelectedBg:         objCursor.strMenuItemSelected,
      rowSelectedHoverBg:    objCursor.strMenuItemSelected,
      fontSize:              objTypo.nSm,
      headerFontSize:        objTypo.nSm,
      cellPaddingBlock:      objSpacing.nSm,
      cellPaddingInline:     objSpacing.nMd,
    },

    // 버튼 — 플랫(Cursor): 그림자 없음, default는 중성 보더
    Button: {
      fontWeight:               500,
      primaryShadow:            'none',
      defaultShadow:            'none',
      dangerShadow:             'none',
      defaultBorderColor:       objCursor.strBorder,
      defaultColor:             bDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.88)',
      defaultBg:                bDark ? objCursor.strBgElevated : objCursor.strBgContainer,
      defaultHoverBg:           objCursor.strMenuItemHover,
      defaultHoverBorderColor:  objCursor.strBorder,
      defaultHoverColor:        bDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.90)',
      primaryColor:             fnContrastText(arrP[IDX_PRIMARY]),
      textHoverBg:              objCursor.strMenuItemHover,
      linkHoverBg:              'transparent',
    },

    // 태그
    Tag: {
      defaultBg:           arrP[IDX_BG],
      defaultColor:        arrP[IDX_DARK1],
      fontSize:            objTypo.nSm,
    },

    // 카드 — 보더 위주, 그림자 최소
    Card: {
      headerBg:       bDark ? objCursor.strBgElevated : objCursor.strBgContainer,
      colorBgContainer: objCursor.strBgContainer,
      colorBorderSecondary: objCursor.strBorderSecondary,
      headerFontSize: objTypo.nMd,
      paddingLG:      objSpacing.nLg,
      boxShadow:      'none',
      boxShadowTertiary: 'none',
    },

    Layout: {
      headerBg:     objCursor.strHeaderBg,
      bodyBg:       objCursor.strBgLayout,
      siderBg:      strSiderBg,
      triggerBg:    strSiderBg,
    },

    // 인풋
    Input: {
      activeBorderColor:  strPrimary,
      hoverBorderColor:   objCursor.strBorder,
      activeShadow:       `0 0 0 2px ${strPrimaryBgSubtle}`,
      fontSize:           objTypo.nBase,
      colorBgContainer:   objCursor.strBgContainer,
      colorBorder:        objCursor.strBorder,
    },

    // 셀렉트
    Select: {
      optionActiveBg:     objCursor.strMenuItemHover,
      optionSelectedBg:   objCursor.strMenuItemSelected,
      optionSelectedColor: bDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)',
      selectorBg:         objCursor.strBgContainer,
      colorBorder:        objCursor.strBorder,
    },

    // 배지
    Badge: {
      colorBgContainer: arrP[IDX_PRIMARY],
    },

    // 스텝
    Steps: {
      iconSize:           Math.round(nFontSize * 1.71),
      customIconSize:     Math.round(nFontSize * 2),
      titleLineHeight:    1.5,
      fontSize:           objTypo.nSm,
    },

    // 타임라인
    Timeline: {
      tailColor:  arrP[IDX_BORDER],
      dotBg:      arrP[IDX_BG],
    },

    // 통계 카드
    Statistic: {
      contentFontSize:  objTypo.nXxl,
      titleFontSize:    objTypo.nSm,
    },

    // 모달
    Modal: {
      contentBg:        objCursor.strBgContainer,
      headerBg:         objCursor.strBgContainer,
      titleColor:       bDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)',
      titleFontSize:    objTypo.nLg,
      titleLineHeight:  1.5,
      borderRadiusLG:   12,
    },

    // 드로어
    Drawer: {
      colorBgElevated:  objCursor.strBgContainer,
      headerFontSize:   objTypo.nMd,
    },

    // 세그먼트 — Cursor pill 트랙
    Segmented: {
      trackBg:           objCursor.strSegmentedTrack,
      itemColor:           objCursor.strMenuItemColor,
      itemHoverColor:      bDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.88)',
      itemSelectedBg:      objCursor.strBgContainer,
      itemSelectedColor:   bDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)',
      borderRadius:        8,
      borderRadiusSM:      6,
    },

    // 스위치
    Switch: {
      colorPrimary:      arrP[IDX_PRIMARY],
      colorPrimaryHover: arrP[IDX_HOVER],
    },

    // 체크박스
    Checkbox: {
      colorPrimary:      arrP[IDX_PRIMARY],
      colorPrimaryHover: arrP[IDX_HOVER],
    },

    // 라디오
    Radio: {
      colorPrimary:      arrP[IDX_PRIMARY],
      colorPrimaryHover: arrP[IDX_HOVER],
    },

    // 슬라이더
    Slider: {
      colorPrimary:          arrP[IDX_PRIMARY],
      colorPrimaryBorderHover: arrP[IDX_HOVER],
      handleColor:           arrP[IDX_PRIMARY],
      handleActiveColor:     arrP[IDX_ACTIVE],
      trackBg:               arrP[IDX_PRIMARY],
      trackHoverBg:          arrP[IDX_HOVER],
    },

    // 페이지네이션 — 활성은 중성 배경 + primary 글자(Cursor)
    Pagination: {
      itemActiveBg:          objCursor.strMenuItemSelected,
      itemActiveColor:       strPrimary,
      itemActiveColorDisabled: objCursor.strMenuItemColor,
      colorText:             objCursor.strMenuItemColor,
      colorTextDisabled:     bDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
      colorBorder:           objCursor.strBorder,
      colorPrimary:          strPrimary,
      colorPrimaryHover:     arrP[IDX_HOVER],
      itemBg:                objCursor.strBgContainer,
      itemLinkBg:            'transparent',
      fontSize:              objTypo.nSm,
    },

    // 탭
    Tabs: {
      inkBarColor:       strPrimary,
      itemColor:         objCursor.strMenuItemColor,
      itemActiveColor:   bDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)',
      itemHoverColor:    bDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.80)',
      itemSelectedColor: bDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)',
      cardBg:            objCursor.strBgContainer,
    },

    // 알림
    Alert: {
      colorSuccessBorder: '#b7eb8f',
      colorErrorBorder:   '#ffa39e',
      colorWarningBorder: '#ffe58f',
      colorInfoBorder:    arrP[IDX_BORDER],
      colorInfoBg:        arrP[IDX_BG],
    },

    // 드롭다운
    Dropdown: {
      colorBgElevated:          objCursor.strBgElevated,
      controlItemBgHover:       objCursor.strMenuItemHover,
      controlItemBgActive:        objCursor.strMenuItemSelected,
      controlItemBgActiveHover:   objCursor.strMenuItemSelected,
    },

    Popconfirm: {
      colorBgElevated: objCursor.strBgElevated,
    },

    Message: {
      contentBg: objCursor.strBgElevated,
    },

    // 아바타
    Avatar: {
      colorTextLightSolid: fnContrastText(arrP[IDX_PRIMARY]),
    },

    // 툴팁
    Tooltip: {
      colorBgSpotlight: bDark ? arrP[IDX_DARK2] : arrP[IDX_DARKEST],
    },

    // 폼
    Form: {
      labelFontSize:   objTypo.nSm,
      itemMarginBottom: objSpacing.nLg,
    },

    // 팝오버
    Popover: {
      titleMinWidth: 120,
    },

    // Descriptions
    Descriptions: {
      titleColor:  arrP[IDX_DARK1],
      labelBg:     arrP[IDX_BG],
      itemPaddingBottom: objSpacing.nSm,
    },

    Divider: {
      colorSplit: objCursor.strBorderSecondary,
    },

    Typography: {
      titleMarginBottom: objSpacing.nSm,
      titleMarginTop: 0,
    },
  };

  return {
    antdThemeConfig: { token: antdToken, components: antdComponents },

    objSider: {
      strBackground:     strSiderBg,
      strLogoBackground: 'transparent',
      strLogoBorder:     strSiderLogoBorder,
      strLogoText:       strSiderLogoText,
      nLogoFontSize:     objTypo.nLg,
      nLogoFontWeight:   600,
      strResizeHandle:   strResizeHandle,
    },

    objHeader: {
      strBackground: strHeaderBg,
      strBorder:     strHeaderBorder,
      strText:       strHeaderText,
    },

    objMenuGroup: {
      strColor:       strMenuGroupColor,
      nFontSize:      nMenuGroupFontSize,
      nFontWeight:    600,
      strLetterSpacing: '0.05em',
      strTextTransform: 'uppercase',
    },

    objShell: {
      strMenuTheme:   bDark ? 'dark' : 'light',
      strContentBg:   objCursor.strBgLayout,
      strSiderBorder: objCursor.strSiderBorder,
      strContentPanelBg: objCursor.strBgContainer,
      strContentPanelBorder: objCursor.strContentPanelBorder,
      nContentPanelRadius,
      nHeaderHeight,
      nLogoHeight,
    },

    objTypo,
    objSpacing,
    arrPalette: arrP,

    objColor: {
      strPrimary:       arrP[IDX_PRIMARY],
      strPrimaryBg:     arrP[IDX_BG],
      strPrimaryHover:  arrP[IDX_HOVER],
      strPrimaryActive: arrP[IDX_ACTIVE],
      strPrimaryBorder: arrP[IDX_BORDER],
      strPrimaryText:   arrP[IDX_PRIMARY],
      strLink:          arrP[IDX_PRIMARY],
      strLinkHover:     arrP[IDX_HOVER],
      strSuccess: '#52c41a',
      strWarning: '#faad14',
      strError:   '#ff4d4f',
      strInfo:    arrP[IDX_PRIMARY],
    },
  };
}
