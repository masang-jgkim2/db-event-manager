/**
 * SQL·쿼리 프리뷰 — Cursor/VS Code 에디터 톤
 * @see docs/CURSOR-UI-AUDIT.md
 */

import type { GlobalToken } from 'antd/es/theme/interface';
import type { CSSProperties } from 'react';
import { STR_FONT_MONO } from './cursorSiteTokens';

/** 읽기 전용 다크 에디터 (Query 생성 결과) */
export const OBJ_SQL_EDITOR_SURFACE = {
  strBackground: '#1e1e1e',
  strForeground: '#d4d4d4',
} as const;

/** Ant Input/TextArea에 붙일 mono 클래스 */
export const STR_CODE_BLOCK_CLASS = 'dqpm-font-mono';

/** 폼·상세·이력 내 SQL (라이트 surface + JetBrains Mono) */
export function fnCodeSurfaceStyle(
  token: GlobalToken,
  nFontSize = 12,
  objExtra?: CSSProperties,
): CSSProperties {
  return {
    fontFamily: STR_FONT_MONO,
    fontSize: nFontSize,
    background: token.colorFillTertiary,
    color: token.colorText,
    border: 'none',
    borderRadius: token.borderRadius,
    ...objExtra,
  };
}

/** QueryPage 읽기 전용 다크 블록 */
export function fnSqlEditorReadonlyStyle(nFontSize = 13): CSSProperties {
  return {
    fontFamily: STR_FONT_MONO,
    fontSize: nFontSize,
    background: OBJ_SQL_EDITOR_SURFACE.strBackground,
    color: OBJ_SQL_EDITOR_SURFACE.strForeground,
    border: 'none',
    borderRadius: 8,
  };
}
