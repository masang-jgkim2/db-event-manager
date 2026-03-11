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

// ─── 팔레트 인덱스 상수 ───────────────────────────────────────
const IDX_BG         = 0;   // 가장 밝은 배경 (선택 배경, 테이블 헤더)
const IDX_BG_HOVER   = 1;   // hover 배경
const IDX_BORDER     = 2;   // 테두리
const IDX_LIGHT      = 3;   // 연한 강조
const IDX_HOVER      = 4;   // hover foreground
const IDX_PRIMARY    = 5;   // primary (기준색)
const IDX_ACTIVE     = 6;   // pressed/active
const IDX_DARK1      = 7;   // 진한 계열 1
const IDX_DARK2      = 8;   // 진한 계열 2
const IDX_DARKEST    = 9;   // 가장 진한 계열

// ─── 사이드바 배경 ───────────────────────────────────────────
// 다크모드: 메인 배경(#141414)과 동일 — 경계 없이 자연스럽게 융합
// 라이트모드: primary 계열 진한 색 + #001529 혼합
function fnSiderBg(arrP: string[], bDark: boolean): string {
  if (bDark) return '#141414';
  return `color-mix(in srgb, ${arrP[IDX_DARKEST]} 60%, #001529 40%)`;
}

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
    strLogoText: string;         // "이벤트 매니저" 텍스트 색
    nLogoFontSize: number;       // 로고 폰트 크기 (px)
    nLogoFontWeight: number;     // 로고 폰트 굵기
    strResizeHandle: string;     // 드래그 핸들 hover 색
    strRightBorder: string;      // 오른쪽 구분선 (다크모드: primary 계열 미세 테두리)
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

  // ── 사이드바 컬러 ────────────────────────────────────────
  const strSiderBg = fnSiderBg(arrP, bDark);
  const strSiderLogoText = 'rgba(255,255,255,0.95)';
  const strSiderLogoBorder = `rgba(255,255,255,0.08)`;
  const strResizeHandle = arrP[IDX_PRIMARY] + '88';

  // ── 헤더 컬러 ────────────────────────────────────────────
  const strHeaderBg     = bDark ? '#141414'   : '#ffffff';
  const strHeaderBorder = bDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const strHeaderText   = bDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.88)';

  // ── 메뉴 그룹 제목 ────────────────────────────────────────
  const strMenuGroupColor  = arrP[IDX_LIGHT];  // primary 연한 계열로 그룹명 강조
  const nMenuGroupFontSize = Math.max(objTypo.nXs, 10);  // 최소 10px

  // ── Ant Design 컴포넌트 토큰 ─────────────────────────────
  const antdToken: Record<string, unknown> = {
    // 기본 색
    colorPrimary:        strPrimary,
    colorPrimaryBg:      arrP[IDX_BG],
    colorPrimaryBgHover: arrP[IDX_BG_HOVER],
    colorPrimaryBorder:  arrP[IDX_BORDER],
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

    // 테두리 반경
    borderRadius:   6,
    borderRadiusSM: 4,
    borderRadiusLG: 8,
    borderRadiusXL: 12,

    // 높이
    controlHeight:   Math.round(nFontSize * 2.57),  // 14→36, 16→41, 25→64
    controlHeightSM: Math.round(nFontSize * 1.71),  // 14→24, 16→27
    controlHeightLG: Math.round(nFontSize * 3.14),  // 14→44, 16→50

    // 그림자 (primary 색 계열)
    boxShadow:          `0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02)`,
    boxShadowSecondary: `0 6px 16px 0 rgba(0,0,0,0.08)`,
  };

  // ── 컴포넌트별 세부 토큰 ─────────────────────────────────
  const antdComponents: Record<string, Record<string, unknown>> = {
    // 메뉴 (사이드바)
    Menu: {
      darkItemBg:             strSiderBg,
      darkSubMenuItemBg:      bDark
        ? `color-mix(in srgb, ${arrP[IDX_DARKEST]} 20%, #0d0d0d 80%)`
        : `color-mix(in srgb, ${arrP[IDX_DARKEST]} 50%, #001121 50%)`,
      darkItemSelectedBg:     arrP[IDX_PRIMARY],
      darkItemSelectedColor:  fnContrastText(arrP[IDX_PRIMARY]),
      darkItemHoverBg:        arrP[IDX_DARK1] + '44',
      darkItemHoverColor:     '#ffffff',
      darkGroupTitleColor:    strMenuGroupColor,
      // 그룹 제목 타이포
      groupTitleFontSize:     nMenuGroupFontSize,
      groupTitleLineHeight:   1.5,
      itemHeight:             Math.max(36, Math.round(nFontSize * 2.57)),
      iconSize:               Math.round(nFontSize * 1.14),
      fontSize:               objTypo.nBase,
    },

    // 테이블
    Table: {
      headerBg:              arrP[IDX_BG],
      headerColor:           bDark ? 'rgba(255,255,255,0.85)' : arrP[IDX_DARK2],
      headerSortActiveBg:    arrP[IDX_BG_HOVER],
      rowHoverBg:            arrP[IDX_BG],
      rowSelectedBg:         arrP[IDX_BG_HOVER],
      rowSelectedHoverBg:    arrP[IDX_BORDER],
      fontSize:              objTypo.nSm,
      headerFontSize:        objTypo.nSm,
      cellPaddingBlock:      objSpacing.nSm,
      cellPaddingInline:     objSpacing.nMd,
    },

    // 버튼 — primary 버튼 텍스트는 배경(primary)과 대비 확보
    Button: {
      fontWeight:               500,
      primaryShadow:            `0 2px 0 ${arrP[IDX_PRIMARY]}33`,
      defaultBorderColor:       arrP[IDX_BORDER],
      defaultColor:             arrP[IDX_PRIMARY],
      // primary 버튼 텍스트/아이콘 색 (배경이 primary이므로 대비 색 자동 선택)
      primaryColor:             fnContrastText(arrP[IDX_PRIMARY]),
    },

    // 태그
    Tag: {
      defaultBg:           arrP[IDX_BG],
      defaultColor:        arrP[IDX_DARK1],
      fontSize:            objTypo.nSm,
    },

    // 카드
    Card: {
      headerBg:       bDark ? '#1f1f1f' : arrP[IDX_BG],
      headerFontSize: objTypo.nMd,
    },

    // 인풋
    Input: {
      activeBorderColor:  arrP[IDX_PRIMARY],
      hoverBorderColor:   arrP[IDX_HOVER],
      activeShadow:       `0 0 0 2px ${arrP[IDX_PRIMARY]}33`,
      fontSize:           objTypo.nBase,
    },

    // 셀렉트
    Select: {
      optionActiveBg:     arrP[IDX_BG],
      optionSelectedBg:   arrP[IDX_BG_HOVER],
      optionSelectedColor: arrP[IDX_PRIMARY],
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
      headerBg:   bDark ? '#1f1f1f' : '#ffffff',
      titleFontSize: objTypo.nLg,
      titleLineHeight: 1.5,
    },

    // 드로어
    Drawer: {
      headerFontSize: objTypo.nMd,
    },

    // 세그먼트
    Segmented: {
      itemSelectedBg:    arrP[IDX_BG_HOVER],
      itemSelectedColor: arrP[IDX_PRIMARY],
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

    // 페이지네이션 — 활성 번호 대비 확보, 비활성 번호 가시성 강화
    Pagination: {
      // 활성 페이지: primary 배경 + 대비 텍스트
      itemActiveBg:          arrP[IDX_PRIMARY],
      itemActiveColor:       fnContrastText(arrP[IDX_PRIMARY]),
      itemActiveColorDisabled: arrP[IDX_HOVER],
      // 비활성 페이지 번호: 충분한 명도 확보
      colorText:             bDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.72)',
      colorTextDisabled:     bDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
      // 테두리
      colorBorder:           arrP[IDX_BORDER],
      colorPrimary:          arrP[IDX_PRIMARY],
      colorPrimaryHover:     arrP[IDX_HOVER],
      itemBg:                bDark ? '#1f1f1f' : '#ffffff',
      itemLinkBg:            bDark ? '#1f1f1f' : '#ffffff',
      fontSize:              objTypo.nSm,
    },

    // 탭
    Tabs: {
      inkBarColor:       arrP[IDX_PRIMARY],
      itemActiveColor:   arrP[IDX_PRIMARY],
      itemHoverColor:    arrP[IDX_HOVER],
      itemSelectedColor: arrP[IDX_PRIMARY],
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
      controlItemBgActive:      arrP[IDX_BG],
      controlItemBgActiveHover: arrP[IDX_BG_HOVER],
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

    // Timeline
    Divider: {
      colorSplit: bDark ? 'rgba(255,255,255,0.08)' : arrP[IDX_BG_HOVER],
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
      nLogoFontWeight:   700,
      strResizeHandle:   strResizeHandle,
      // 다크모드: 배경이 메인과 같아지므로 primary 계열 미세 구분선으로 영역 구분
      strRightBorder:    bDark
        ? `1px solid ${arrP[IDX_PRIMARY]}33`
        : 'none',
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
      strLetterSpacing: '0.06em',
      strTextTransform: 'uppercase',
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
