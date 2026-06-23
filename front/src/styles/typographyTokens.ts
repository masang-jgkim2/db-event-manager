/**
 * getdesign Cursor DESIGN.md 타이포 역할
 * @see front/DESIGN.md
 * 기준 body 16px — UI 설정 `nFontSize`로 전체 비율 스케일
 */

import type { CSSProperties } from 'react';

/** DESIGN.md 단일 스타일 역할 */
export interface ITypographyRoleStyle {
  nFontSize: number;
  nFontWeight: number;
  nLineHeight: number;
  strLetterSpacing: string;
  bUppercase?: boolean;
}

/** 앱에서 쓰는 타이포 역할 집합 */
export interface ITypographyRoles {
  pageTitle: ITypographyRoleStyle;
  titleMd: ITypographyRoleStyle;
  titleSm: ITypographyRoleStyle;
  bodyMd: ITypographyRoleStyle;
  bodySm: ITypographyRoleStyle;
  caption: ITypographyRoleStyle;
  captionUppercase: ITypographyRoleStyle;
  code: ITypographyRoleStyle;
  button: ITypographyRoleStyle;
  navLink: ITypographyRoleStyle;
}

const N_DESIGN_BODY_PX = 16;

function fnPx(nDesignPx: number, nScale: number): number {
  return Math.round(nDesignPx * nScale * 10) / 10;
}

function fnLetterSpacing(nDesignPx: number, nScale: number): string {
  if (nDesignPx === 0) return '0';
  return `${Math.round(nDesignPx * nScale * 100) / 100}px`;
}

function fnRole(
  nDesignFontSize: number,
  nFontWeight: number,
  nLineHeight: number,
  nDesignLetterSpacing: number,
  nScale: number,
  bUppercase?: boolean,
): ITypographyRoleStyle {
  return {
    nFontSize: fnPx(nDesignFontSize, nScale),
    nFontWeight,
    nLineHeight,
    strLetterSpacing: fnLetterSpacing(nDesignLetterSpacing, nScale),
    ...(bUppercase ? { bUppercase: true } : {}),
  };
}

/** UI 설정 본문 크기(px) → DESIGN.md 역할 스케일 */
export function fnBuildTypographyRoles(nBodyPx: number): ITypographyRoles {
  const nScale = nBodyPx / N_DESIGN_BODY_PX;

  return {
    pageTitle: fnRole(22, 400, 1.3, -0.11, nScale),
    titleMd: fnRole(18, 600, 1.4, 0, nScale),
    titleSm: fnRole(16, 600, 1.4, 0, nScale),
    bodyMd: fnRole(16, 400, 1.5, 0, nScale),
    bodySm: fnRole(14, 400, 1.5, 0, nScale),
    caption: fnRole(13, 400, 1.4, 0, nScale),
    captionUppercase: fnRole(11, 600, 1.4, 0.88, nScale, true),
    code: fnRole(13, 400, 1.5, 0, nScale),
    button: fnRole(14, 500, 1, 0, nScale),
    navLink: fnRole(14, 500, 1.4, 0, nScale),
  };
}

/** 인라인·Typography에 주입할 React 스타일 */
export function fnTypoStyle(objRole: ITypographyRoleStyle): CSSProperties {
  return {
    fontSize: objRole.nFontSize,
    fontWeight: objRole.nFontWeight,
    lineHeight: objRole.nLineHeight,
    letterSpacing: objRole.strLetterSpacing,
    ...(objRole.bUppercase ? { textTransform: 'uppercase' as const } : {}),
  };
}
